import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-sync-secret',
      },
    });
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    // Verify sync secret
    const secret = req.headers.get('x-sync-secret');
    if (secret !== Deno.env.get('SYNC_SECRET')) {
      console.error('Unauthorized: invalid or missing x-sync-secret header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const application = body.application;
    if (!application) {
      return new Response(JSON.stringify({ error: 'Missing application object in body' }), { status: 400, headers: corsHeaders });
    }

    const base44 = createClientFromRequest(req);
    const created = await base44.asServiceRole.entities.Application.create(application);

    console.log('Application created:', created.id);
    return new Response(JSON.stringify({ success: true, id: created.id }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('receiveApplication error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});