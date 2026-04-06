import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, and, gt, inArray } from 'drizzle-orm';
import db from '../db-postgres.js';
import { users, staffProfiles } from '../schema.js';
import { generateToken, requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.post('/hub-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is inactive. Contact administration.' });
    }
    if (!user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Your account has not been set up yet. Please use the registration link from your invitation email.' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
    const token = generateToken(user);
    await logAudit({
      userId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
    });
    const roleForRoute = user.role.replace('_', '-');
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: roleForRoute,
        firstName: user.firstName,
        lastName: user.lastName,
        full_name: `${user.firstName} ${user.lastName}`,
      },
    });
  } catch (err) {
    console.error('Hub login error:', err);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required.' });
  }
  try {
    let user;
    if (email) {
      [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    } else {
      [user] = await db.select().from(users).where(eq(users.role, 'admin'));
    }
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
    if (!user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Account not set up yet. Use your invitation link to create a password.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is inactive. Contact administration.' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
    const token = generateToken(user);
    await logAudit({ userId: user.id, action: 'login', entityType: 'user', entityId: user.id, ipAddress: req.ip });
    return res.json({
      success: true,
      token,
      user: { id: user.id, role: user.role, email: user.email, full_name: `${user.firstName} ${user.lastName}` },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!user) return res.json({ user: null });
    const roleForRoute = user.role.replace('_', '-');
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: roleForRoute,
        firstName: user.firstName,
        lastName: user.lastName,
        full_name: `${user.firstName} ${user.lastName}`,
      },
    });
  } catch {
    return res.json({ user: null });
  }
});

const DEV_ALLOWED_EMAILS = [
  'admin@elevateperformance-academy.com',
  'sarah.johnson@example.com',
  'ethan.johnson@example.com',
  'coach.martinez@elevateperformance-academy.com',
  'coach.williams@elevateperformance-academy.com',
];

router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (!DEV_ALLOWED_EMAILS.includes(normalizedEmail)) {
    return res.status(403).json({ success: false, error: 'This email is not authorized for dev login.' });
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const token = generateToken(user);
    const roleForRoute = user.role.replace('_', '-');
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: roleForRoute,
        firstName: user.firstName,
        lastName: user.lastName,
        full_name: `${user.firstName} ${user.lastName}`,
      },
    });
  } catch (err) {
    console.error('Dev login error:', err);
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/register-invite', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, error: 'Token and password are required.' });
  }

  const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters with one uppercase letter and one special character.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const updated = await db.update(users).set({
      passwordHash,
      inviteToken: null,
      inviteTokenExpiry: null,
      status: 'active',
    }).where(
      and(
        eq(users.inviteToken, token),
        gt(users.inviteTokenExpiry, new Date())
      )
    ).returning();

    if (!updated.length) {
      return res.status(400).json({ success: false, error: 'Invalid or expired invitation link, or account is not eligible for registration.' });
    }
    const user = updated[0];

    const jwtToken = generateToken(user);
    await logAudit({
      userId: user.id,
      action: 'register',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
    });

    const roleForRoute = user.role.replace('_', '-');
    return res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: roleForRoute,
        firstName: user.firstName,
        lastName: user.lastName,
        full_name: `${user.firstName} ${user.lastName}`,
      },
    });
  } catch (err) {
    console.error('Register invite error:', err);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

router.get('/verify-invite', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Token is required.' });
  }
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      inviteTokenExpiry: users.inviteTokenExpiry,
    }).from(users).where(eq(users.inviteToken, token));
    if (!user) {
      console.log(`[VERIFY-INVITE] Token not found — token prefix: ${token.substring(0, 16)}...`);
      return res.status(400).json({ success: false, error: 'Invalid or expired invitation link.', code: 'INVALID_TOKEN' });
    }
    if (user.inviteTokenExpiry && new Date(user.inviteTokenExpiry) < new Date()) {
      console.log(`[VERIFY-INVITE] Token expired — userId: ${user.id}, email: ${user.email}, expired: ${user.inviteTokenExpiry}`);
      return res.status(400).json({ success: false, error: 'Your invitation link has expired. Please contact your academy administrator to request a new one.', code: 'TOKEN_EXPIRED' });
    }
    console.log(`[VERIFY-INVITE] Token valid — userId: ${user.id}, email: ${user.email}`);
    return res.json({ success: true, user: { firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } catch (err) {
    console.error('[VERIFY-INVITE] Error:', err);
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ success: true });
});

router.post('/register', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, password, role, firstName, lastName, title, bio } = req.body;
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ success: false, error: 'Email, password, first name, and last name are required.' });
  }
  const validRoles = ['parent', 'student', 'academic_coach', 'performance_coach', 'admin'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }
  try {
    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (existing) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'parent',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    }).returning();

    if (role === 'academic_coach' || role === 'performance_coach' || role === 'admin') {
      await db.insert(staffProfiles).values({
        userId: newUser.id,
        title: title || null,
        bio: bio || null,
      });
    }

    await logAudit({
      userId: req.user.id,
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      details: { role: newUser.role, email: newUser.email },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

export default router;
