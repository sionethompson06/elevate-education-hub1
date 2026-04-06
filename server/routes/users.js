import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc, ne } from 'drizzle-orm';
import { Resend } from 'resend';
import db from '../db-postgres.js';
import { users, staffProfiles, guardianStudents, students } from '../schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

let resend = null;
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const router = Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const showArchived = req.query.archived === 'true';
    const query = db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      status: users.status,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));

    const allUsers = showArchived
      ? await query.where(eq(users.status, 'archived'))
      : await query.where(ne(users.status, 'archived'));

    res.json({ success: true, users: allUsers });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      status: users.status,
      createdAt: users.createdAt,
      inviteTokenExpiry: users.inviteTokenExpiry,
      hasPassword: users.passwordHash,
      hasInviteToken: users.inviteToken,
    }).from(users).where(eq(users.id, id));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    let inviteStatus = null;
    if (user.role === 'parent') {
      if (user.hasPassword) {
        inviteStatus = 'registered';
      } else if (user.hasInviteToken) {
        if (user.inviteTokenExpiry && new Date(user.inviteTokenExpiry) < new Date()) {
          inviteStatus = 'expired';
        } else {
          inviteStatus = 'pending';
        }
      } else {
        inviteStatus = 'not_invited';
      }
    }

    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      createdAt: user.createdAt,
      inviteStatus,
      inviteTokenExpiry: user.role === 'parent' ? user.inviteTokenExpiry : undefined,
    };

    let staff = null;
    if (['academic_coach', 'performance_coach', 'admin'].includes(user.role)) {
      const [sp] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, id));
      staff = sp || null;
    }

    res.json({ success: true, user: userResponse, staffProfile: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/linked-students', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid user ID' });
    const linkedStudents = await db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        dateOfBirth: students.dateOfBirth,
        grade: students.grade,
        status: students.status,
        relationship: guardianStudents.relationship,
        isPrimary: guardianStudents.isPrimary,
      })
      .from(guardianStudents)
      .innerJoin(students, eq(guardianStudents.studentId, students.id))
      .where(eq(guardianStudents.guardianUserId, id));
    res.json({ success: true, students: linkedStudents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/send-invite', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid user ID' });

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
    }).from(users).where(eq(users.id, id));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const linkedStudents = await db
      .select({
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(guardianStudents)
      .innerJoin(students, eq(guardianStudents.studentId, students.id))
      .where(eq(guardianStudents.guardianUserId, id));

    const studentNames = linkedStudents.map((s) => `${s.firstName} ${s.lastName}`).join(', ');

    const { randomBytes } = await import('crypto');
    const inviteToken = randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.update(users).set({ inviteToken, inviteTokenExpiry, passwordHash: null }).where(eq(users.id, id));

    const configuredUrl = process.env.APP_URL || '';
    const isLocalhost = !configuredUrl || configuredUrl.includes('localhost') || configuredUrl.includes('127.0.0.1');
    let baseUrl = isLocalhost
      ? `${req.protocol}://${req.get('host')}`
      : configuredUrl;
    baseUrl = baseUrl.replace(/\/+$/, '');
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    const registerUrl = `${baseUrl}/register?token=${inviteToken}`;

    console.log(`[INVITE] Sending invite — userId: ${id}, email: ${user.email}, baseUrl: ${baseUrl}, registerUrl: ${registerUrl}`);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Elevate Performance Academy <noreply@mail.elevateperformance-academy.com>';

    const portalLabelMap = {
      parent: 'Parent Portal', student: 'Student Portal',
      academic_coach: 'Academic Coach Portal', performance_coach: 'Performance Coach Portal', admin: 'Admin Portal',
    };
    const portalLabel = portalLabelMap[user.role] || 'Portal';

    const isParent = user.role === 'parent' || user.role === 'user';
    const bodyHtml = isParent
      ? `<p style="font-size: 16px; line-height: 1.6;">Welcome to Elevate Performance Academy! We are excited to have your family join our community.</p>
          <p style="font-size: 16px; line-height: 1.6;">Your child${linkedStudents.length > 1 ? 'ren' : ''}, <strong>${studentNames || 'your student'}</strong>, ${linkedStudents.length > 1 ? 'have' : 'has'} been accepted into our program.</p>
          <p style="font-size: 16px; line-height: 1.6;">To get started, please click the button below to create your password and set up your account.</p>`
      : `<p style="font-size: 16px; line-height: 1.6;">Welcome to Elevate Performance Academy! You have been invited to join the platform as a <strong>${portalLabel}</strong> member.</p>
          <p style="font-size: 16px; line-height: 1.6;">To get started, please click the button below to create your password and set up your account.</p>`;

    const r = getResend();
    if (!r) { console.log('[INVITE] No RESEND_API_KEY — skipping email, invite URL:', registerUrl); return res.json({ success: true, inviteUrl: registerUrl }); }
    const { data, error } = await r.emails.send({
      from: fromAddress,
      to: [user.email],
      subject: 'Welcome to Elevate Performance Academy — Set Up Your Account',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Elevate Performance Academy</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">${portalLabel} Invitation</p>
          </div>
          <p style="font-size: 16px; line-height: 1.6;">Dear ${user.firstName} ${user.lastName},</p>
          ${bodyHtml}
          <div style="text-align: center; margin: 32px 0;">
            <a href="${registerUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Set Up My Account</a>
          </div>
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">This link will expire in 7 days. If you need a new link, please contact the academy.</p>
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">If you have any questions, please don't hesitate to reach out.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">Elevate Performance Academy<br/>This is an automated message from the Elevate Performance Hub.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend email error:', error);
      // Don't fail — return the invite URL so admin can share it manually
      return res.json({ success: true, emailSent: false, emailError: error.message, registerUrl, inviteUrl: registerUrl });
    }

    await logAudit({
      userId: req.user.id,
      action: 'send_invite',
      entityType: 'user',
      entityId: id,
      details: { recipientEmail: user.email, resendId: data?.id },
      ipAddress: req.ip,
    });

    res.json({ success: true, emailSent: true, message: 'Invite email sent successfully', emailId: data?.id, registerUrl, inviteUrl: registerUrl });
  } catch (err) {
    console.error('Send invite error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email, role, firstName, lastName, status, password, title, bio } = req.body;
    const updateData = {};
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (role !== undefined) updateData.role = role;
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (status !== undefined) updateData.status = status;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    if (Object.keys(updateData).length === 0 && title === undefined && bio === undefined) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    let updated;
    if (Object.keys(updateData).length > 0) {
      [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    } else {
      [updated] = await db.select().from(users).where(eq(users.id, id));
    }
    if (!updated) return res.status(404).json({ success: false, error: 'User not found' });

    if (title !== undefined || bio !== undefined) {
      const [existing] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, id));
      if (existing) {
        const staffUpdate = {};
        if (title !== undefined) staffUpdate.title = title;
        if (bio !== undefined) staffUpdate.bio = bio;
        await db.update(staffProfiles).set(staffUpdate).where(eq(staffProfiles.userId, id));
      } else {
        await db.insert(staffProfiles).values({ userId: id, title: title || null, bio: bio || null });
      }
    }

    await logAudit({
      userId: req.user.id,
      action: 'update',
      entityType: 'user',
      entityId: id,
      details: { ...updateData, passwordHash: undefined },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        firstName: updated.firstName,
        lastName: updated.lastName,
        status: updated.status,
      },
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot archive your own account' });
    }
    await db.update(users).set({ status: 'archived' }).where(eq(users.id, id));
    await logAudit({
      userId: req.user.id,
      action: 'archive',
      entityType: 'user',
      entityId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/restore', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(users).set({ status: 'active' }).where(eq(users.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
    await logAudit({
      userId: req.user.id,
      action: 'restore',
      entityType: 'user',
      entityId: id,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/my-profile — returns current user's profile with linked students (for parents)
router.get('/my-profile', requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    let linkedStudents = [];
    if (user.role === 'parent') {
      linkedStudents = await db.select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        grade: students.grade,
        status: students.status,
      }).from(guardianStudents)
        .innerJoin(students, eq(guardianStudents.studentId, students.id))
        .where(eq(guardianStudents.guardianUserId, user.id));
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      full_name: `${user.firstName} ${user.lastName}`,
      student_ids: linkedStudents.map(s => s.id),
      students: linkedStudents,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/add-student — link an existing student to the current parent
router.post('/add-student', requireAuth, requireRole('parent', 'admin'), async (req, res) => {
  try {
    const { studentId, relationship } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const [existing] = await db.select().from(guardianStudents).where(
      eq(guardianStudents.guardianUserId, req.user.id)
    );

    await db.insert(guardianStudents).values({
      guardianUserId: req.user.id,
      studentId: Number(studentId),
      relationship: relationship || 'parent',
      isPrimary: !existing,
    }).onConflictDoNothing();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/invite — list pending/invited users
router.get('/invite', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const pending = await db.select({ id: users.id, email: users.email, role: users.role, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.status, 'invited'));
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/invite — create user record and send invite email in one step
router.post('/invite', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { email, role, firstName, lastName } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const validRoles = ['parent', 'student', 'academic_coach', 'performance_coach', 'admin'];
    const assignedRole = validRoles.includes(role) ? role : 'parent';

    const emailLower = email.toLowerCase().trim();
    let userId;

    const [existing] = await db.select().from(users).where(eq(users.email, emailLower));
    if (existing) {
      // Allow resend for any existing user — works as both re-invite and password reset
      await db.update(users).set({ role: assignedRole }).where(eq(users.id, existing.id));
      userId = existing.id;
    } else {
      const derivedFirst = firstName?.trim() || emailLower.split('@')[0];
      const derivedLast = lastName?.trim() || '';
      const [created] = await db.insert(users).values({
        email: emailLower,
        role: assignedRole,
        firstName: derivedFirst,
        lastName: derivedLast,
        status: 'invited',
      }).returning();
      userId = created.id;

      // Auto-create staff profile for coaches
      if (['academic_coach', 'performance_coach', 'admin'].includes(assignedRole)) {
        await db.insert(staffProfiles).values({ userId, title: null, bio: null }).onConflictDoNothing();
      }
    }

    // Generate invite token (7-day expiry)
    const { randomBytes } = await import('crypto');
    const inviteToken = randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.update(users).set({ inviteToken, inviteTokenExpiry }).where(eq(users.id, userId));

    const [invitedUser] = await db.select().from(users).where(eq(users.id, userId));

    const configuredUrl2 = process.env.APP_URL || '';
    const isLocalhost2 = !configuredUrl2 || configuredUrl2.includes('localhost') || configuredUrl2.includes('127.0.0.1');
    let baseUrl = isLocalhost2
      ? `${req.protocol}://${req.get('host')}`
      : configuredUrl2;
    baseUrl = baseUrl.replace(/\/+$/, '');
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    const registerUrl = `${baseUrl}/register?token=${inviteToken}`;

    const roleLabels = {
      parent: 'Parent Portal', student: 'Student Portal',
      academic_coach: 'Academic Coach Portal', performance_coach: 'Performance Coach Portal', admin: 'Admin Portal',
    };
    const portalLabel = roleLabels[assignedRole] || 'Portal';

    const r = getResend();
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Elevate Performance Academy <noreply@mail.elevateperformance-academy.com>';

    const isParentRole = assignedRole === 'parent' || assignedRole === 'user';
    const inviteBodyHtml = isParentRole
      ? `<p style="font-size: 16px; line-height: 1.6;">Welcome to Elevate Performance Academy! We are excited to have your family join our community.</p>
          <p style="font-size: 16px; line-height: 1.6;">To get started, please click the button below to create your password and set up your account.</p>`
      : `<p style="font-size: 16px; line-height: 1.6;">Welcome to Elevate Performance Academy! You have been invited to join the platform as a <strong>${portalLabel}</strong> member.</p>
          <p style="font-size: 16px; line-height: 1.6;">To get started, please click the button below to create your password and set up your account.</p>`;

    if (r) {
      const { error } = await r.emails.send({
        from: fromAddress,
        to: [emailLower],
        subject: 'Welcome to Elevate Performance Academy — Set Up Your Account',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Elevate Performance Academy</h1>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">${portalLabel} Invitation</p>
            </div>
            <p style="font-size: 16px; line-height: 1.6;">Dear ${invitedUser.firstName} ${invitedUser.lastName},</p>
            ${inviteBodyHtml}
            <div style="text-align: center; margin: 32px 0;">
              <a href="${registerUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Set Up My Account</a>
            </div>
            <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">This link will expire in 7 days. If you need a new link, please contact the academy.</p>
            <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">If you have any questions, please don't hesitate to reach out.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">Elevate Performance Academy<br/>This is an automated message from the Elevate Performance Hub.</p>
          </div>
        `,
      });
      if (error) console.error('[INVITE] Resend error:', error.message);
    } else {
      console.log(`[INVITE] No RESEND_API_KEY — invite URL: ${registerUrl}`);
    }
    // Always include registerUrl in response so admin can share manually if email fails

    await logAudit({
      userId: req.user.id,
      action: 'invite',
      entityType: 'user',
      entityId: userId,
      details: { email: emailLower, role: assignedRole },
      ipAddress: req.ip,
    });

    res.json({ success: true, user: { id: userId, email: emailLower, role: assignedRole, firstName: invitedUser.firstName, lastName: invitedUser.lastName }, inviteUrl: registerUrl, registerUrl });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
