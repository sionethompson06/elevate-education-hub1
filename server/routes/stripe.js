import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../db-postgres.js';
import { enrollments, users, programs, billingAccounts, payments, invoices, students } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getOrCreateCustomer, createCheckoutSession, createPortalSession, constructWebhookEvent
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
    const [latestInvoice] = await db.select().from(invoices)
      .where(eq(invoices.enrollmentId, Number(enrollment_id)))
      .orderBy(desc(invoices.createdAt))
      .limit(1);
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
      successUrl: success_url || `${origin}/parent/dashboard?payment=success&enrollment=${enrollment_id}`,
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

// POST /api/stripe/webhook — handle Stripe events (raw body required — mounted separately)
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  let event;
  try {
    event = constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const enrollmentId = session.metadata?.enrollment_id;
      const parentUserId = session.metadata?.parent_user_id;

      if (enrollmentId) {
        // Activate enrollment
        await db.update(enrollments).set({ status: 'active' })
          .where(eq(enrollments.id, Number(enrollmentId)));

        // Fetch enrollment to get studentId
        const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, Number(enrollmentId)));

        // Update student status to active
        if (enrollment?.studentId) {
          await db.update(students).set({ status: 'active' })
            .where(eq(students.id, enrollment.studentId));
        }

        // Fetch billing account for payment record + invoice update
        let billingAccountId = null;
        if (parentUserId) {
          const [billingAccount] = await db.select().from(billingAccounts)
            .where(eq(billingAccounts.parentUserId, Number(parentUserId)));
          billingAccountId = billingAccount?.id ?? null;
        }

        // Find invoice linked to this enrollment and mark it paid
        let invoiceId = null;
        const [linkedInvoice] = await db.select().from(invoices)
          .where(eq(invoices.enrollmentId, Number(enrollmentId)));
        if (linkedInvoice) {
          invoiceId = linkedInvoice.id;
          await db.update(invoices)
            .set({ status: 'paid', paidDate: new Date().toISOString().split('T')[0], stripePaymentId: session.payment_intent || session.id })
            .where(eq(invoices.id, linkedInvoice.id));
        }

        // Insert payment record linked to billing account + invoice
        if (billingAccountId) {
          await db.insert(payments).values({
            billingAccountId,
            invoiceId,
            amount: String(session.amount_total / 100),
            method: 'stripe',
            stripePaymentIntentId: session.payment_intent || session.subscription || session.id,
            status: 'paid',
            processedAt: new Date(),
          }).catch(err => console.error('[webhook] payment record error:', err));
        }

        // Notify parent via email
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
            );
          }
        }
        console.log(`[stripe] Enrollment ${enrollmentId} activated, invoice marked paid, student activated`);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        // Find enrollment with this subscription and mark payment_failed
        console.log(`[stripe] Payment failed for subscription ${subscriptionId}`);
      }
    }
  } catch (err) {
    console.error('[stripe] Webhook handler error:', err.message);
  }

  res.json({ received: true });
}

export default router;
