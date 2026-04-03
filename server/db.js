import Database from '@replit/database';

const db = new Database();

export const ApplicationDB = {
  async create(data) {
    const id = `app_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const record = {
      id,
      ...data,
      status: 'submitted',
      created_date: new Date().toISOString(),
    };
    await db.set(`application:${id}`, record);
    return record;
  },

  async list(sortBy = '-created_date', limit = 100) {
    const keys = await db.list('application:');
    const records = await Promise.all(
      keys.map(async (key) => {
        const val = await db.get(key);
        return val;
      })
    );
    const valid = records.filter(Boolean);
    valid.sort((a, b) => {
      if (sortBy === '-created_date') {
        return new Date(b.created_date) - new Date(a.created_date);
      }
      return new Date(a.created_date) - new Date(b.created_date);
    });
    return valid.slice(0, limit);
  },

  async get(id) {
    return db.get(`application:${id}`);
  },

  async update(id, data) {
    const existing = await db.get(`application:${id}`);
    if (!existing) throw new Error('Application not found');
    const updated = { ...existing, ...data };
    await db.set(`application:${id}`, updated);
    return updated;
  },

  async delete(id) {
    await db.delete(`application:${id}`);
  },

  async filter(query = {}) {
    const all = await this.list('-created_date', 500);
    return all.filter((app) => {
      return Object.entries(query).every(([key, val]) => app[key] === val);
    });
  },
};

export default db;
