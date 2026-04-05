import Stripe from 'stripe';

let stripeClient = null;

export function getStripe() {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export async function getOrCreateCustomer(email, name, metadata = {}) {
  const stripe = getStripe();
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length) return existing.data[0];
  return stripe.customers.create({ email, name, metadata });
}

export async function createCheckoutSession({ enrollmentId, studentId, parentUserId, stripeCustomerId, program, billingCycle, successUrl, cancelUrl }) {
  const stripe = getStripe();
  const isSubscription = billingCycle === 'monthly' || billingCycle === 'annual';
  const unitAmount = billingCycle === 'annual'
    ? Math.round(((program?.tuitionAmount || 2400) * 12) * 100)
    : Math.round((program?.tuitionAmount || 250) * 100);

  const metadata = {
    enrollment_id: String(enrollmentId),
    student_id: String(studentId),
    parent_user_id: String(parentUserId),
    billing_cycle: billingCycle || 'one_time',
  };

  const sessionParams = {
    customer: stripeCustomerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  };

  if (isSubscription) {
    sessionParams.mode = 'subscription';
    sessionParams.line_items = [{
      price_data: {
        currency: 'usd',
        unit_amount: unitAmount,
        recurring: { interval: billingCycle === 'annual' ? 'year' : 'month' },
        product_data: { name: program?.name || 'Elevate Program' },
      },
      quantity: 1,
    }];
    sessionParams.subscription_data = { metadata };
  } else {
    sessionParams.mode = 'payment';
    sessionParams.line_items = [{
      price_data: {
        currency: 'usd',
        unit_amount: unitAmount,
        product_data: { name: program?.name || 'Elevate Program' },
      },
      quantity: 1,
    }];
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export async function createPortalSession(stripeCustomerId, returnUrl) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
}

export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
