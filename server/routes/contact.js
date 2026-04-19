import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import db from '../db-postgres.js';
import { contacts } from '../schema.js';
import { desc } from 'drizzle-orm';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ success: false, error: 'Email is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'Message is required' });
    await db.insert(contacts).values({ name: name.trim(), email: email.trim(), message: message.trim() });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const records = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    res.json({ success: true, contacts: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
