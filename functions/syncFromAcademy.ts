import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PERF_ACADEMY_URL = "https://elevateperformance-academy.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log("Calling Performance Academy:", PERF_ACADEMY_URL);

    const perfResponse = await fetch(PERF_ACADEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const responseText = await perfResponse.text();
    console.log("Performance Academy response status:", perfResponse.status);
    console.log("Performance Academy response body:", responseText);

    if (!perfResponse.ok) {
      return Response.json({ success: false, error: `Academy returned ${perfResponse.status}: ${responseText}` }, { status: 500 });
    }

    const { applications: perfApps = [] } = JSON.parse(responseText);
    console.log(`Got ${perfApps.length} applications from Academy`);

    // 2. Read existing Hub applications for dedup
    const hubApps = await base44.asServiceRole.entities.Application.list("-created_date", 500);

    const existingKeys = new Set(
      hubApps.map(a => `${a.email}|${a.student_first_name}|${a.student_last_name}`)
    );

    // 3. Filter to only new ones
    const seen = new Set();
    const toCreate = [];
    for (const a of perfApps) {
      const key = `${a.email}|${a.student_first_name}|${a.student_last_name}`;
      if (existingKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      toCreate.push(a);
    }

    if (toCreate.length === 0) {
      return Response.json({ success: true, message: "Already up to date — no new applications.", synced: 0 });
    }

    // 4. Create new ones in the Hub
    const created = await Promise.all(
      toCreate.map(a => base44.asServiceRole.entities.Application.create({
        parent_first_name: a.parent_first_name || "",
        parent_last_name:  a.parent_last_name  || "",
        email:             a.email             || "",
        phone:             a.phone             || null,
        student_first_name: a.student_first_name || "",
        student_last_name:  a.student_last_name  || "",
        student_birth_date: a.student_birth_date || null,
        student_age:        a.student_age        || null,
        student_grade:      a.student_grade      || "",
        program_interest:   a.program_interest   || "",
        status:             a.status === "accepted" || a.status === "approved" ? "approved" : "submitted",
        submitted_at:       a.created_date ? new Date(a.created_date).toISOString() : new Date().toISOString(),
        applicant_email:    a.email || "",
        notes: [
          a.sports_played     ? `Sports: ${a.sports_played}`           : null,
          a.competition_level ? `Competition Level: ${a.competition_level}` : null,
          a.referral_source   ? `Referral: ${a.referral_source}`        : null,
          a.essay             ? `Essay: ${a.essay}`                     : null,
        ].filter(Boolean).join(" | ") || null,
      }))
    );

    return Response.json({
      success: true,
      message: `Synced ${created.length} new application${created.length !== 1 ? "s" : ""} from Performance Academy.`,
      synced: created.length,
    });

  } catch (err) {
    console.error("syncFromAcademy crashed:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});