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
  const tuition = Number(program?.tuitionAmount);
  if (!tuition || isNaN(tuition) || tuition <= 0) {
    throw new Error('Program tuition amount is not configured. Please contact support.');
  }
  // For annual billing prefer the explicit annual price from metadata, then one_time price,
  // then fall back to monthly × 12 so programs without metadata still work.
  const prices = program?.metadata?.prices;
  const unitAmount = billingCycle === 'annual'
    ? Math.round((prices?.annual ?? prices?.one_time ?? tuition * 12) * 100)
    : Math.round(tuition * 100);

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

// Creates a single Stripe Checkout session for multiple programs (family invoice)
export async function createFamilyCheckoutSession({
  familyInvoiceId,
  parentUserId,
  billingAccountId,
  stripeCustomerId,
  lineItems,   // [{ programName, studentName, amountDollars }]
  successUrl,
  cancelUrl,
}) {
  const stripe = getStripe();

  if (!lineItems || lineItems.length === 0) {
    throw new Error('At least one line item is required for family checkout.');
  }

  const stripeLineItems = lineItems.map(item => ({
    price_data: {
      currency: 'usd',
      unit_amount: Math.round(item.amountDollars * 100),
      product_data: {
        name: item.programName || 'Elevate Program',
        ...(item.studentName ? { description: `Student: ${item.studentName}` } : {}),
      },
    },
    quantity: 1,
  }));

  const metadata = {
    family_invoice_id: String(familyInvoiceId),
    parent_user_id: String(parentUserId),
    billing_account_id: String(billingAccountId),
  };

  return stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'payment',
    line_items: stripeLineItems,
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function createPortalSession(stripeCustomerId, returnUrl) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
}

export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
