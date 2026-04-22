import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db-postgres.js';
import { enrollments, users, programs, billingAccounts, payments, invoices, students, familyInvoices } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getStripe, getOrCreateCustomer, createCheckoutSession, createFamilyCheckoutSession,
  createPortalSession, constructWebhookEvent
} from '../services/stripe.service.js';
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail } from '../services/email.service.js';

const router = Router();

// POST /api/stripe/checkout — create a Stripe Checkout session
router.post('/checkout', requireAuth, requireRole('parent', 'admin'), async (req, res) => {
  try {
    const { enrollment_id, billing_cycle, success_url, cancel_url } = req.body;
    if (!enrollment_id) return res.status(400).json({ error: 'enrollment_id required' });

    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, Number(enrollment_id)));
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    // Fetch latest invoice first so the guard can check payment status
    const [latestInvoice] = await db.select().from(invoices)
      .where(eq(invoices.enrollmentId, Number(enrollment_id)))
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    // Block only when genuinely paid. active_override with a pending invoice means a partial
    // scholarship was applied and the remaining balance still needs to be collected.
    if (enrollment.status === 'active' ||
        (enrollment.status === 'active_override' && latestInvoice?.status === 'paid')) {
      return res.status(400).json({ error: 'Enrollment is already active and paid.' });
    }

    // Verify parent owns this enrollment (skip for admin)
    if (req.user.role === 'parent') {
      const { guardianStudents } = await import('../schema.js');
      const [guardianCheck] = await db.select().from(guardianStudents)
        .where(and(eq(guardianStudents.guardianUserId, req.user.id), eq(guardianStudents.studentId, enrollment.studentId)));
      if (!guardianCheck) {
        return res.status(403).json({ error: 'Not authorized to checkout for this student' });
      }
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    const [program] = enrollment.programId
      ? await db.select().from(programs).where(eq(programs.id, enrollment.programId))
      : [null];

    // Use admin-edited invoice amount if one exists; fall back to program tuition
    const effectiveTuition = latestInvoice?.amount != null
      ? Number(latestInvoice.amount)
      : Number(program?.tuitionAmount);
    const effectiveProgram = program
      ? { ...program, tuitionAmount: effectiveTuition }
      : { tuitionAmount: effectiveTuition };

    // Get or create billing account and Stripe customer
    let [billingAccount] = await db.select().from(billingAccounts).where(eq(billingAccounts.parentUserId, req.user.id));
    let stripeCustomerId = billingAccount?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await getOrCreateCustomer(user.email, `${user.firstName} ${user.lastName}`, { user_id: String(user.id) });
      stripeCustomerId = customer.id;
      if (billingAccount) {
        await db.update(billingAccounts).set({ stripeCustomerId }).where(eq(billingAccounts.id, billingAccount.id));
      } else {
        [billingAccount] = await db.insert(billingAccounts).values({
          parentUserId: req.user.id,
          stripeCustomerId,
          balance: '0',
        }).returning();
      }
    }

    const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:5173';
    const session = await createCheckoutSession({
      enrollmentId: enrollment_id,
      studentId: enrollment.studentId,
      parentUserId: req.user.id,
      stripeCustomerId,
      program: effectiveProgram,
      billingCycle: billing_cycle || 'one_time',
      successUrl: success_url || `${origin}/parent/dashboard?payment=success&enrollment=${enrollment_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: cancel_url || `${origin}/parent/programs`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/portal — create a billing portal session
router.post('/portal', requireAuth, requireRole('parent', 'admin'), async (req, res) => {
  try {
    const { return_url } = req.body;
    const [billingAccount] = await db.select().from(billingAccounts).where(eq(billingAccounts.parentUserId, req.user.id));
    if (!billingAccount?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found. Complete a payment first.' });
    }
    const origin = req.headers.origin || process.env.APP_URL;
    const session = await createPortalSession(
      billingAccount.stripeCustomerId,
      return_url || `${origin}/parent/payments`
    );
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/stripe/verify-payment — frontend fallback: verify a checkout session and activate enrollment
router.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const { enrollment_id, session_id } = req.body;
    if (!enrollment_id || !session_id) {
      return res.status(400).json({ error: 'enrollment_id and session_id required' });
    }

    // Verify payment status directly with Stripe
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.json({ activated: false, reason: 'not_paid', status: session.payment_status });
    }

    const enrollmentId = Number(enrollment_id);
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId));
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    // Idempotent — already active
    if (['active', 'active_override'].includes(enrollment.status)) {
      return res.json({ activated: true, alreadyActive: true });
    }

    // Activate enrollment and student
    await db.update(enrollments).set({ status: 'active' }).where(eq(enrollments.id, enrollmentId));
    if (enrollment.studentId) {
      await db.update(students).set({ status: 'active' }).where(eq(students.id, enrollment.studentId));
    }

    // Mark invoice paid (if not already done by webhook)
    const [invoice] = await db.select().from(invoices)
      .where(eq(invoices.enrollmentId, enrollmentId))
      .orderBy(desc(invoices.createdAt))
      .limit(1);
    if (invoice && invoice.status !== 'paid') {
      await db.update(invoices)
        .set({
          status: 'paid',
          paidDate: new Date().toISOString().split('T')[0],
          stripePaymentId: String(session.payment_intent || session_id),
        })
        .where(eq(invoices.id, invoice.id));
    }

    // Create payment record only if webhook hasn't done it yet
    if (invoice && session.amount_total) {
      const [existingPayment] = await db.select().from(payments)
        .where(eq(payments.invoiceId, invoice.id));
      if (!existingPayment) {
        const [billingAccount] = await db.select().from(billingAccounts)
          .where(eq(billingAccounts.id, invoice.billingAccountId));
        if (billingAccount) {
          await db.insert(payments).values({
            billingAccountId: billingAccount.id,
            invoiceId: invoice.id,
            amount: String(session.amount_total / 100),
            method: 'stripe',
            stripePaymentIntentId: String(session.payment_intent || session_id),
            status: 'paid',
            processedAt: new Date(),
          }).catch(err => console.error('[verify-payment] payment record error:', err));
        }
      }
    }

    console.log(`[stripe] verify-payment: enrollment ${enrollmentId} activated via session ${session_id}`);
    res.json({ activated: true });
  } catch (err) {
    console.error('[stripe/verify-payment] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/family-checkout — create a Stripe Checkout session for a family invoice
router.post('/family-checkout', requireAuth, requireRole('parent', 'admin'), async (req, res) => {
  try {
    const { family_invoice_id, success_url, cancel_url } = req.body;
    if (!family_invoice_id) return res.status(400).json({ error: 'family_invoice_id required' });

    const [fi] = await db.select().from(familyInvoices)
      .where(eq(familyInvoices.id, Number(family_invoice_id)));
    if (!fi) return res.status(404).json({ error: 'Family invoice not found' });
    if (fi.status === 'paid') return res.status(400).json({ error: 'Family invoice is already paid.' });

    // Verify the billing account belongs to this parent
    const [billingAccount] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.id, fi.billingAccountId));
    if (!billingAccount) return res.status(404).json({ error: 'Billing account not found' });
    if (req.user.role === 'parent' && billingAccount.parentUserId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this family invoice' });
    }

    // Load child invoices with enriched line item info
    const { inArray: inArr } = await import('drizzle-orm');
    const childInvoices = await db.select().from(invoices)
      .where(eq(invoices.familyInvoiceId, fi.id));

    if (childInvoices.length === 0) {
      return res.status(400).json({ error: 'Family invoice has no line items.' });
    }

    // Fetch enrollment/program/student info for each child invoice
    const enrollmentIds = [...new Set(childInvoices.filter(i => i.enrollmentId).map(i => i.enrollmentId))];
    let enrollmentMap = {};
    if (enrollmentIds.length > 0) {
      const { enrollments: enr, programs: prog, students: stu } = await import('../schema.js');
      const rows = await db.select({
        id: enr.id,
        programName: prog.name,
        studentFirstName: stu.firstName,
        studentLastName: stu.lastName,
      }).from(enr)
        .leftJoin(prog, eq(enr.programId, prog.id))
        .leftJoin(stu, eq(enr.studentId, stu.id))
        .where(inArr(enr.id, enrollmentIds));
      enrollmentMap = Object.fromEntries(rows.map(r => [r.id, r]));
    }

    const lineItems = childInvoices.map(inv => {
      const e = inv.enrollmentId ? enrollmentMap[inv.enrollmentId] : null;
      const studentName = e?.studentFirstName
        ? `${e.studentFirstName} ${e.studentLastName || ''}`.trim()
        : null;
      return {
        programName: e?.programName || inv.description || 'Elevate Program',
        studentName,
        amountDollars: parseFloat(inv.amount || 0),
      };
    });

    // Get or create Stripe customer
    const [parentUser] = await db.select().from(users).where(eq(users.id, billingAccount.parentUserId));
    let stripeCustomerId = billingAccount.stripeCustomerId;
    if (!stripeCustomerId && parentUser) {
      const customer = await getOrCreateCustomer(
        parentUser.email,
        `${parentUser.firstName} ${parentUser.lastName}`,
        { user_id: String(parentUser.id) }
      );
      stripeCustomerId = customer.id;
      await db.update(billingAccounts).set({ stripeCustomerId }).where(eq(billingAccounts.id, billingAccount.id));
    }

    const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:5173';
    const session = await createFamilyCheckoutSession({
      familyInvoiceId: fi.id,
      parentUserId: billingAccount.parentUserId,
      billingAccountId: billingAccount.id,
      stripeCustomerId,
      lineItems,
      successUrl: success_url || `${origin}/parent/payments?payment=success&family_invoice=${fi.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: cancel_url || `${origin}/parent/payments`,
    });

    // Store the session ID on the family invoice for webhook lookup
    await db.update(familyInvoices)
      .set({ stripeSessionId: session.id })
      .where(eq(familyInvoices.id, fi.id));

    res.json({ url: session.url, sessionId: session.id, familyInvoiceId: fi.id });
  } catch (err) {
    console.error('[stripe] family-checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/verify-family-payment — frontend fallback for family invoice payments
router.post('/verify-family-payment', requireAuth, async (req, res) => {
  try {
    const { family_invoice_id, session_id } = req.body;
    if (!family_invoice_id || !session_id) {
      return res.status(400).json({ error: 'family_invoice_id and session_id required' });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.json({ activated: false, reason: 'not_paid', status: session.payment_status });
    }

    const [fi] = await db.select().from(familyInvoices)
      .where(eq(familyInvoices.id, Number(family_invoice_id)));
    if (!fi) return res.status(404).json({ error: 'Family invoice not found' });

    // Idempotent
    if (fi.status === 'paid') return res.json({ activated: true, alreadyActive: true });

    const today = new Date().toISOString().split('T')[0];
    const stripePaymentId = String(session.payment_intent || session_id);

    await db.update(familyInvoices)
      .set({ status: 'paid', paidDate: today, stripePaymentId })
      .where(eq(familyInvoices.id, fi.id));

    // Mark all child invoices paid + activate enrollments
    const childInvoices = await db.select().from(invoices)
      .where(eq(invoices.familyInvoiceId, fi.id));

    for (const inv of childInvoices) {
      if (inv.status !== 'paid') {
        await db.update(invoices)
          .set({ status: 'paid', paidDate: today, stripePaymentId })
          .where(eq(invoices.id, inv.id));
      }
      if (inv.enrollmentId) {
        const [enr] = await db.select().from(enrollments).where(eq(enrollments.id, inv.enrollmentId));
        if (enr && !['active', 'active_override'].includes(enr.status)) {
          await db.update(enrollments).set({ status: 'active' }).where(eq(enrollments.id, enr.id));
          if (enr.studentId) {
            await db.update(students).set({ status: 'active' }).where(eq(students.id, enr.studentId));
          }
        }
      }
    }

    // Create one payment record for the total if not already done
    const firstInvoice = childInvoices[0];
    if (firstInvoice && session.amount_total) {
      const [existing] = await db.select().from(payments)
        .where(eq(payments.invoiceId, firstInvoice.id));
      if (!existing) {
        await db.insert(payments).values({
          billingAccountId: fi.billingAccountId,
          invoiceId: firstInvoice.id,
          amount: String(session.amount_total / 100),
          method: 'stripe',
          stripePaymentIntentId: stripePaymentId,
          status: 'paid',
          processedAt: new Date(),
        }).catch(err => console.error('[verify-family-payment] payment record error:', err));
      }
    }

    console.log(`[stripe] verify-family-payment: family invoice ${fi.id} activated`);
    res.json({ activated: true });
  } catch (err) {
    console.error('[stripe/verify-family-payment] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook — handle Stripe events (raw body required — mounted separately)
export async function stripeWebhookHandler(req, res) {
  let event;

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // Secret not configured — parse body directly (acceptable for test mode)
    try {
      event = JSON.parse(req.body.toString());
      console.warn('[stripe] Webhook signature verification SKIPPED — set STRIPE_WEBHOOK_SECRET in env for production');
    } catch (err) {
      return res.status(400).send('Invalid webhook body');
    }
  } else {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).send('Missing stripe-signature');
    try {
      event = constructWebhookEvent(req.body, sig);
    } catch (err) {
      console.error('Stripe webhook signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  try {
    // ── Initial payment: one-time or first subscription charge ─────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const familyInvoiceId = session.metadata?.family_invoice_id;
      const enrollmentId = session.metadata?.enrollment_id;
      const parentUserId = session.metadata?.parent_user_id;
      const today = new Date().toISOString().split('T')[0];
      const stripePaymentId = session.payment_intent || session.subscription || session.id;

      if (familyInvoiceId) {
        // ── Family invoice payment ──────────────────────────────────────────
        const [fi] = await db.select().from(familyInvoices)
          .where(eq(familyInvoices.id, Number(familyInvoiceId)));

        if (fi && fi.status !== 'paid') {
          await db.update(familyInvoices)
            .set({ status: 'paid', paidDate: today, stripePaymentId: String(stripePaymentId) })
            .where(eq(familyInvoices.id, fi.id));

          // Mark all child invoices paid + activate their enrollments/students
          const childInvoices = await db.select().from(invoices)
            .where(eq(invoices.familyInvoiceId, fi.id));

          const programNames = [];
          for (const inv of childInvoices) {
            if (inv.status !== 'paid') {
              await db.update(invoices)
                .set({ status: 'paid', paidDate: today, stripePaymentId: String(stripePaymentId) })
                .where(eq(invoices.id, inv.id));
            }
            if (inv.enrollmentId) {
              const [enr] = await db.select().from(enrollments)
                .where(eq(enrollments.id, inv.enrollmentId));
              if (enr) {
                if (!['active', 'active_override'].includes(enr.status)) {
                  await db.update(enrollments).set({ status: 'active' })
                    .where(eq(enrollments.id, enr.id));
                }
                if (enr.studentId) {
                  await db.update(students).set({ status: 'active' })
                    .where(eq(students.id, enr.studentId));
                }
                if (enr.programId) {
                  const [prog] = await db.select().from(programs)
                    .where(eq(programs.id, enr.programId));
                  if (prog?.name) programNames.push(prog.name);
                }
              }
            }
          }

          // One payment record for the total amount
          const firstInvoice = childInvoices[0];
          await db.insert(payments).values({
            billingAccountId: fi.billingAccountId,
            invoiceId: firstInvoice?.id || null,
            amount: String(session.amount_total / 100),
            method: 'stripe',
            stripePaymentIntentId: String(stripePaymentId),
            status: 'paid',
            processedAt: new Date(),
          }).catch(err => console.error('[webhook] family payment record error:', err));

          if (parentUserId) {
            const [parentUser] = await db.select().from(users)
              .where(eq(users.id, Number(parentUserId)));
            if (parentUser) {
              const programSummary = programNames.length > 0
                ? programNames.join(', ')
                : 'your programs';
              await sendPaymentConfirmationEmail(
                parentUser.email,
                `${parentUser.firstName} ${parentUser.lastName}`,
                session.amount_total,
                programSummary
              ).catch(err => console.error('[webhook] family confirmation email error:', err));
            }
          }
          console.log(`[stripe] Family invoice ${familyInvoiceId} paid — ${childInvoices.length} enrollment(s) activated`);
        }
      } else if (enrollmentId) {
        // ── Single enrollment payment (existing flow) ───────────────────────
        await db.update(enrollments).set({ status: 'active' })
          .where(eq(enrollments.id, Number(enrollmentId)));

        const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, Number(enrollmentId)));

        if (enrollment?.studentId) {
          await db.update(students).set({ status: 'active' })
            .where(eq(students.id, enrollment.studentId));
        }

        let billingAccountId = null;
        if (parentUserId) {
          const [billingAccount] = await db.select().from(billingAccounts)
            .where(eq(billingAccounts.parentUserId, Number(parentUserId)));
          billingAccountId = billingAccount?.id ?? null;
        }

        let invoiceId = null;
        const [linkedInvoice] = await db.select().from(invoices)
          .where(eq(invoices.enrollmentId, Number(enrollmentId)))
          .orderBy(desc(invoices.createdAt))
          .limit(1);
        if (linkedInvoice) {
          invoiceId = linkedInvoice.id;
          await db.update(invoices)
            .set({ status: 'paid', paidDate: today, stripePaymentId: String(stripePaymentId) })
            .where(eq(invoices.id, linkedInvoice.id));
        }

        if (billingAccountId) {
          await db.insert(payments).values({
            billingAccountId,
            invoiceId,
            amount: String(session.amount_total / 100),
            method: 'stripe',
            stripePaymentIntentId: String(stripePaymentId),
            status: 'paid',
            processedAt: new Date(),
          }).catch(err => console.error('[webhook] payment record error:', err));
        }

        if (parentUserId && enrollment) {
          const [prog] = enrollment.programId
            ? await db.select().from(programs).where(eq(programs.id, enrollment.programId))
            : [null];
          const [parentUser] = await db.select().from(users).where(eq(users.id, Number(parentUserId)));
          if (parentUser) {
            await sendPaymentConfirmationEmail(
              parentUser.email,
              `${parentUser.firstName} ${parentUser.lastName}`,
              session.amount_total,
              prog?.name || 'your program'
            ).catch(err => console.error('[webhook] confirmation email error:', err));
          }
        }
        console.log(`[stripe] Enrollment ${enrollmentId} activated, invoice paid, student activated`);
      }
    }

    // ── Recurring subscription charge succeeded ─────────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
      const stripeInvoice = event.data.object;
      const subscriptionId = stripeInvoice.subscription;
      // Skip first payment — already handled by checkout.session.completed
      if (subscriptionId && stripeInvoice.billing_reason !== 'subscription_create') {
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const enrollmentId = subscription.metadata?.enrollment_id;
        const parentUserId = subscription.metadata?.parent_user_id;

        if (enrollmentId) {
          let billingAccountId = null;
          if (parentUserId) {
            const [billingAccount] = await db.select().from(billingAccounts)
              .where(eq(billingAccounts.parentUserId, Number(parentUserId)));
            billingAccountId = billingAccount?.id ?? null;
          }

          const [linkedInvoice] = await db.select().from(invoices)
            .where(eq(invoices.enrollmentId, Number(enrollmentId)))
            .orderBy(desc(invoices.createdAt))
            .limit(1);

          // Update invoice to reflect latest payment date
          if (linkedInvoice) {
            await db.update(invoices)
              .set({
                status: 'paid',
                paidDate: new Date().toISOString().split('T')[0],
                stripePaymentId: String(stripeInvoice.payment_intent || subscriptionId),
              })
              .where(eq(invoices.id, linkedInvoice.id));
          }

          // Create a payment record for this recurring charge
          if (billingAccountId) {
            await db.insert(payments).values({
              billingAccountId,
              invoiceId: linkedInvoice?.id || null,
              amount: String(stripeInvoice.amount_paid / 100),
              method: 'stripe',
              stripePaymentIntentId: String(stripeInvoice.payment_intent || subscriptionId),
              status: 'paid',
              processedAt: new Date(),
            }).catch(err => console.error('[webhook] recurring payment record error:', err));
          }

          // Send renewal confirmation email
          if (parentUserId) {
            const [parentUser] = await db.select().from(users).where(eq(users.id, Number(parentUserId)));
            const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, Number(enrollmentId)));
            if (parentUser && enrollment) {
              const [prog] = enrollment.programId
                ? await db.select().from(programs).where(eq(programs.id, enrollment.programId))
                : [null];
              await sendPaymentConfirmationEmail(
                parentUser.email,
                `${parentUser.firstName} ${parentUser.lastName}`,
                stripeInvoice.amount_paid,
                prog?.name || 'your program'
              ).catch(err => console.error('[webhook] renewal email error:', err));
            }
          }
          console.log(`[stripe] Recurring payment recorded for enrollment ${enrollmentId}`);
        }
      }
    }

    // ── Subscription payment failed ─────────────────────────────────────────
    if (event.type === 'invoice.payment_failed') {
      const stripeInvoice = event.data.object;
      const subscriptionId = stripeInvoice.subscription;
      if (subscriptionId) {
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const enrollmentId = subscription.metadata?.enrollment_id;
        const parentUserId = subscription.metadata?.parent_user_id;

        if (enrollmentId) {
          await db.update(enrollments).set({ status: 'payment_failed' })
            .where(eq(enrollments.id, Number(enrollmentId)));

          const [linkedInvoice] = await db.select().from(invoices)
            .where(eq(invoices.enrollmentId, Number(enrollmentId)))
            .orderBy(desc(invoices.createdAt))
            .limit(1);
          if (linkedInvoice) {
            await db.update(invoices).set({ status: 'past_due' })
              .where(eq(invoices.id, linkedInvoice.id));
          }

          if (parentUserId) {
            const [parentUser] = await db.select().from(users).where(eq(users.id, Number(parentUserId)));
            const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, Number(enrollmentId)));
            if (parentUser && enrollment) {
              const [prog] = enrollment.programId
                ? await db.select().from(programs).where(eq(programs.id, enrollment.programId))
                : [null];
              await sendPaymentFailedEmail(
                parentUser.email,
                `${parentUser.firstName} ${parentUser.lastName}`,
                prog?.name || 'your program'
              ).catch(err => console.error('[webhook] failure email error:', err));
            }
          }
          console.log(`[stripe] Payment failed, enrollment ${enrollmentId} marked payment_failed`);
        }
      }
    }

    // ── One-time payment failed (no subscription involved) ─────────────────
    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      const enrollmentId = intent.metadata?.enrollment_id;
      const parentUserId = intent.metadata?.parent_user_id;

      if (enrollmentId) {
        await db.update(enrollments).set({ status: 'payment_failed' })
          .where(eq(enrollments.id, Number(enrollmentId)));

        const [linkedInvoice] = await db.select().from(invoices)
          .where(eq(invoices.enrollmentId, Number(enrollmentId)))
          .orderBy(desc(invoices.createdAt))
          .limit(1);
        if (linkedInvoice) {
          await db.update(invoices).set({ status: 'past_due' })
            .where(eq(invoices.id, linkedInvoice.id));
        }

        if (parentUserId) {
          const [parentUser] = await db.select().from(users).where(eq(users.id, Number(parentUserId)));
          const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, Number(enrollmentId)));
          if (parentUser && enrollment) {
            const [prog] = enrollment.programId
              ? await db.select().from(programs).where(eq(programs.id, enrollment.programId))
              : [null];
            await sendPaymentFailedEmail(
              parentUser.email,
              `${parentUser.firstName} ${parentUser.lastName}`,
              prog?.name || 'your program'
            ).catch(err => console.error('[webhook] one-time failure email error:', err));
          }
        }
        console.log(`[stripe] One-time payment failed, enrollment ${enrollmentId} marked payment_failed`);
      }
    }

    // ── Subscription cancelled (non-payment or admin action in Stripe) ──────
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const enrollmentId = subscription.metadata?.enrollment_id;
      if (enrollmentId) {
        await db.update(enrollments).set({ status: 'cancelled' })
          .where(eq(enrollments.id, Number(enrollmentId)));
        console.log(`[stripe] Subscription deleted, enrollment ${enrollmentId} marked cancelled`);
      }
    }
  } catch (err) {
    console.error('[stripe] Webhook handler error:', err.message);
  }

  res.json({ received: true });
}

export default router;
