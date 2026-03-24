import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const db = base44.asServiceRole;

  // Idempotency check
  const existing = await db.entities.StripeWebhookEvent.filter({ stripe_event_id: event.id });
  if (existing.length > 0 && existing[0].processed) {
    console.log(`Skipping already processed event: ${event.id}`);
    return Response.json({ received: true });
  }

  // Record event
  let webhookRecord;
  if (existing.length === 0) {
    webhookRecord = await db.entities.StripeWebhookEvent.create({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: JSON.stringify(event),
      processed: false,
    });
  } else {
    webhookRecord = existing[0];
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata || {};
        const enrollmentId = meta.enrollment_id;
        if (!enrollmentId) break;

        const amount = (session.amount_total || 0) / 100;
        const isSubscription = session.mode === 'subscription';

        // Create Payment record
        const payment = await db.entities.Payment.create({
          enrollment_id: enrollmentId,
          student_id: meta.student_id || '',
          amount,
          currency: session.currency || 'usd',
          status: 'succeeded',
          payment_method: isSubscription ? 'stripe_subscription' : 'stripe_checkout',
          stripe_payment_intent_id: session.payment_intent || '',
          paid_at: new Date().toISOString(),
          description: `Checkout session ${session.id}`,
        });

        // Update enrollment
        const updates = {
          status: 'active',
          payment_status: 'paid',
          payment_method: isSubscription ? 'stripe_subscription' : 'stripe_checkout',
        };
        if (isSubscription && session.subscription) {
          updates.stripe_subscription_id = session.subscription;
        }
        await db.entities.Enrollment.update(enrollmentId, updates);

        console.log(`checkout.session.completed: enrollment ${enrollmentId} activated`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        const enrollments = await db.entities.Enrollment.filter({ stripe_subscription_id: subId });
        const enrollment = enrollments[0];
        if (!enrollment) break;

        await db.entities.Payment.create({
          enrollment_id: enrollment.id,
          student_id: enrollment.student_id,
          amount: (invoice.amount_paid || 0) / 100,
          currency: invoice.currency || 'usd',
          status: 'succeeded',
          payment_method: 'stripe_subscription',
          stripe_invoice_id: invoice.id,
          paid_at: new Date().toISOString(),
          description: `Invoice ${invoice.number || invoice.id}`,
        });

        await db.entities.Enrollment.update(enrollment.id, {
          status: 'active',
          payment_status: 'paid',
        });

        console.log(`invoice.paid: enrollment ${enrollment.id} renewed`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        const enrollments = await db.entities.Enrollment.filter({ stripe_subscription_id: subId });
        const enrollment = enrollments[0];
        if (!enrollment) break;

        await db.entities.Payment.create({
          enrollment_id: enrollment.id,
          student_id: enrollment.student_id,
          amount: (invoice.amount_due || 0) / 100,
          currency: invoice.currency || 'usd',
          status: 'failed',
          payment_method: 'stripe_subscription',
          stripe_invoice_id: invoice.id,
          description: `Failed invoice ${invoice.id}`,
        });

        await db.entities.Enrollment.update(enrollment.id, {
          status: 'payment_failed',
          payment_status: 'unpaid',
        });

        console.log(`invoice.payment_failed: enrollment ${enrollment.id} set to payment_failed`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const enrollments = await db.entities.Enrollment.filter({ stripe_subscription_id: sub.id });
        const enrollment = enrollments[0];
        if (!enrollment) break;

        const statusMap = {
          active: 'active',
          past_due: 'payment_failed',
          canceled: 'cancelled',
          paused: 'paused',
          unpaid: 'payment_failed',
        };
        const newStatus = statusMap[sub.status] || enrollment.status;
        await db.entities.Enrollment.update(enrollment.id, { status: newStatus });
        console.log(`subscription.updated: enrollment ${enrollment.id} -> ${newStatus}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const enrollments = await db.entities.Enrollment.filter({ stripe_subscription_id: sub.id });
        const enrollment = enrollments[0];
        if (!enrollment) break;

        await db.entities.Enrollment.update(enrollment.id, { status: 'cancelled' });
        console.log(`subscription.deleted: enrollment ${enrollment.id} cancelled`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await db.entities.StripeWebhookEvent.update(webhookRecord.id, {
      processed: true,
      processed_at: new Date().toISOString(),
    });

    return Response.json({ received: true });
  } catch (error) {
    console.error(`Error processing ${event.type}:`, error.message);
    await db.entities.StripeWebhookEvent.update(webhookRecord.id, {
      error: error.message,
    });
    return Response.json({ error: error.message }, { status: 500 });
  }
});