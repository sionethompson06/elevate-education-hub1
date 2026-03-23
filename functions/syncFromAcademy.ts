import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// The builder should replace this with the actual Performance Academy functions URL
// Found in: Performance Academy app → Code → Functions → Copy URL
const PERF_ACADEMY_URL = "https://<PERFORMANCE-ACADEMY-URL>/functions/getAllApplications";

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