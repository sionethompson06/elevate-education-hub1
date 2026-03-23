import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PERF_ACADEMY_URL = "https://genius-84fd149d.base44.app/functions/receiveApplication";

Deno.serve(async (req) => {
  try {
    const response = await fetch(PERF_ACADEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const result = await response.json();
    return Response.json(result);
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});