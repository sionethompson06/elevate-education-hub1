import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Only admins can invite users
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, role } = await req.json();
    if (!email || !role) {
      return Response.json({ error: 'email and role required' }, { status: 400 });
    }

    // Invite the user (platform only supports "user" or "admin" natively)
    const inviteRole = role === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(email.trim(), inviteRole);
    console.log(`Invited ${email} as platform role: ${inviteRole}`);

    // If a custom role is needed, poll for the user record and update it
    if (role !== 'user' && role !== 'admin') {
      let targetUser = null;
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
        targetUser = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (targetUser) break;
        console.log(`Polling attempt ${i + 1}: user not found yet...`);
      }

      if (targetUser) {
        await base44.asServiceRole.entities.User.update(targetUser.id, { role });
        console.log(`Role updated to "${role}" for ${email}`);
      } else {
        console.warn(`Could not find user record for ${email} after polling — role not set`);
        return Response.json({
          success: true,
          warning: 'Invite sent but role could not be set automatically. Please set it manually from User Management.',
        });
      }
    }

    return Response.json({ success: true, message: `${email} invited with role: ${role}` });
  } catch (err) {
    console.error('inviteAndSetRole error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});