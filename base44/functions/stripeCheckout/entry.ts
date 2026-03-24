import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { enrollment_id, billing_cycle, success_url, cancel_url } = await req.json();
    if (!enrollment_id) return Response.json({ error: 'enrollment_id required' }, { status: 400 });

    // Load enrollment
    const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ id: enrollment_id });
    const enrollment = enrollments[0];
    if (!enrollment) return Response.json({ error: 'Enrollment not found' }, { status: 404 });

    // Verify parent owns this enrollment
    const parents = await base44.asServiceRole.entities.Parent.filter({ user_email: user.email });
    const parent = parents[0];
    if (!parent) return Response.json({ error: 'Parent record not found' }, { status: 403 });
    if (!parent.student_ids?.includes(enrollment.student_id)) {
      return Response.json({ error: 'Forbidden: not your enrollment' }, { status: 403 });
    }

    // Get or create Stripe customer
    let stripeCustomerId = enrollment.stripe_customer_id || parent.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: parent.full_name,
        metadata: { parent_id: parent.id, base44_app_id: Deno.env.get('BASE44_APP_ID') },
      });
      stripeCustomerId = customer.id;
      // Save on parent record for reuse
      await base44.asServiceRole.entities.Parent.update(parent.id, { stripe_customer_id: stripeCustomerId });
    }

    // Load program pricing from CmsPricingPlan or fallback to Program entity
    const programs = await base44.asServiceRole.entities.Program.filter({ name: enrollment.program_name });
    const program = programs[0];

    const isSubscription = billing_cycle === 'monthly' || billing_cycle === 'annual';
    const unitAmount = billing_cycle === 'annual'
      ? Math.round((program?.price_annual || 2400) * 100)
      : Math.round((program?.price_monthly || 250) * 100);

    const stripePrice = billing_cycle === 'annual'
      ? program?.stripe_price_id_annual
      : program?.stripe_price_id_monthly;

    let sessionParams = {
      customer: stripeCustomerId,
      success_url: success_url || `${req.headers.get('origin')}/parent/dashboard?payment=success&enrollment=${enrollment_id}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/parent/dashboard?payment=cancelled`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        enrollment_id,
        student_id: enrollment.student_id,
        parent_id: parent.id,
        billing_cycle: billing_cycle || 'one_time',
      },
    };

    if (isSubscription && stripePrice) {
      // Use existing Stripe price for subscription
      sessionParams.mode = 'subscription';
      sessionParams.line_items = [{ price: stripePrice, quantity: 1 }];
      sessionParams.subscription_data = {
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
          enrollment_id,
          student_id: enrollment.student_id,
        },
      };
    } else if (isSubscription) {
      // Create price on-the-fly
      sessionParams.mode = 'subscription';
      sessionParams.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: { name: enrollment.program_name || 'Tuition', metadata: { enrollment_id } },
          unit_amount: unitAmount,
          recurring: { interval: billing_cycle === 'annual' ? 'year' : 'month' },
        },
        quantity: 1,
      }];
      sessionParams.subscription_data = {
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
          enrollment_id,
          student_id: enrollment.student_id,
        },
      };
    } else {
      // One-time payment
      sessionParams.mode = 'payment';
      sessionParams.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: { name: enrollment.program_name || 'Enrollment Deposit', metadata: { enrollment_id } },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }];
      sessionParams.invoice_creation = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Update enrollment with Stripe customer + billing cycle
    await base44.asServiceRole.entities.Enrollment.update(enrollment_id, {
      stripe_customer_id: stripeCustomerId,
      billing_cycle: billing_cycle || 'one_time',
      payment_method: isSubscription ? 'stripe_subscription' : 'stripe_checkout',
    });

    console.log(`Checkout session created: ${session.id} for enrollment ${enrollment_id}`);
    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('stripeCheckout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});