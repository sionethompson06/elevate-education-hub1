import db from '../db-postgres.js';
import { notifications } from '../schema.js';

export async function createNotification({ userId, type, title, body, link }) {
  try {
    const [notif] = await db.insert(notifications).values({
      userId,
      type,
      title,
      body: body || null,
      link: link || null,
    }).returning();
    return notif;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

export async function createNotificationForUsers(userIds, { type, title, body, link }) {
  const results = [];
  for (const userId of userIds) {
    const notif = await createNotification({ userId, type, title, body, link });
    if (notif) results.push(notif);
  }
  return results;
}
