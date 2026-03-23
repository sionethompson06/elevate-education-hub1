import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { return_url } = await req.json();

    const parents = await base44.asServiceRole.entities.Parent.filter({ user_email: user.email });
    const parent = parents[0];
    if (!parent) return Response.json({ error: 'Parent record not found' }, { status: 404 });

    if (!parent.stripe_customer_id) {
      return Response.json({ error: 'No Stripe customer found. Please complete a payment first.' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: parent.stripe_customer_id,
      return_url: return_url || `${req.headers.get('origin')}/parent/payments`,
    });

    console.log(`Stripe portal session created for ${user.email}`);
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('stripePortal error:', error.message);
    // Return 400 for Stripe API errors (e.g. portal not configured) so frontend can handle gracefully
    const status = error.type?.startsWith('Stripe') || error.statusCode ? 400 : 500;
    return Response.json({ error: error.message }, { status });
  }
});