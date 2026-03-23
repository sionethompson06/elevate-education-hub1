import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SYNC_SECRET = "elevate-sync-2026";

Deno.serve(async (req) => {
  const secret = req.headers.get("x-sync-secret");
  if (secret !== SYNC_SECRET) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const base44 = createClientFromRequest(req);
    const applications = await base44.asServiceRole.entities.Application.list("-created_date", 500);
    return Response.json({ success: true, applications });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});