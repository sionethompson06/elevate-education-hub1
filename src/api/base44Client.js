// Replit-compatible API client — replaces Base44 SDK
// Provides a compatible interface so existing code continues to work

const LOCAL_STORAGE_KEY = 'elevate_auth_user';
const LOCAL_STORAGE_TOKEN_KEY = 'elevate_auth_token';

// Simple in-memory store for entities (demo/dev mode)
const entityStore = {};

function getStore(entityName) {
  if (!entityStore[entityName]) {
    entityStore[entityName] = [];
  }
  return entityStore[entityName];
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Entity CRUD helper
function makeEntityClient(entityName) {
  return {
    async list(filters = {}) {
      const store = getStore(entityName);
      let results = [...store];
      for (const [key, val] of Object.entries(filters)) {
        results = results.filter(item => item[key] === val);
      }
      return results;
    },
    async get(id) {
      const store = getStore(entityName);
      return store.find(item => item.id === id) || null;
    },
    async create(data) {
      const store = getStore(entityName);
      const item = { ...data, id: generateId(), created_date: new Date().toISOString() };
      store.push(item);
      return item;
    },
    async update(id, data) {
      const store = getStore(entityName);
      const idx = store.findIndex(item => item.id === id);
      if (idx >= 0) {
        store[idx] = { ...store[idx], ...data };
        return store[idx];
      }
      return null;
    },
    async delete(id) {
      const store = getStore(entityName);
      const idx = store.findIndex(item => item.id === id);
      if (idx >= 0) {
        store.splice(idx, 1);
        return true;
      }
      return false;
    },
  };
}

// Auth module
const auth = {
  async me() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  },
  async login(email, password) {
    // Demo login — returns a mock user based on email prefix
    const roleMap = {
      admin: 'admin',
      student: 'student',
      parent: 'parent',
      coach: 'academic_coach',
      performance: 'performance_coach',
    };
    const prefix = email.split('@')[0].toLowerCase();
    let role = 'student';
    for (const [key, val] of Object.entries(roleMap)) {
      if (prefix.includes(key)) { role = val; break; }
    }
    const user = {
      id: generateId(),
      email,
      full_name: email.split('@')[0].replace(/[._]/g, ' '),
      role,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, 'demo-token-' + generateId());
    return user;
  },
  async logout() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
  },
  redirectToLogin(returnUrl) {
    window.location.href = '/login' + (returnUrl ? `?from=${encodeURIComponent(returnUrl)}` : '');
  },
};

// Functions module (stubs for Base44 server functions)
const functions = {
  async invoke(functionName, params = {}) {
    console.log(`[base44.functions] invoke: ${functionName}`, params);
    // Return sensible stubs per function
    switch (functionName) {
      case 'getGradebook': return { grades: [], summary: {} };
      case 'getRewards': return { points: 0, badges: [], history: [] };
      case 'enrollStudent': return { success: true, enrollment: {} };
      case 'stripeCheckout': return { url: null, sessionId: null };
      case 'getAttendance': return { records: [], summary: {} };
      case 'getSchedule': return { events: [] };
      case 'getMessages': return { messages: [], channels: [] };
      case 'getAnalytics': return { data: {} };
      default: return {};
    }
  },
};

// Entity clients for all used entities
const entities = {
  AccessLog: makeEntityClient('AccessLog'),
  User: makeEntityClient('User'),
  Student: makeEntityClient('Student'),
  Parent: makeEntityClient('Parent'),
  AcademicCoach: makeEntityClient('AcademicCoach'),
  PerformanceCoach: makeEntityClient('PerformanceCoach'),
  Enrollment: makeEntityClient('Enrollment'),
  Attendance: makeEntityClient('Attendance'),
  Grade: makeEntityClient('Grade'),
  Reward: makeEntityClient('Reward'),
  Message: makeEntityClient('Message'),
  Resource: makeEntityClient('Resource'),
  Schedule: makeEntityClient('Schedule'),
  Program: makeEntityClient('Program'),
  Payment: makeEntityClient('Payment'),
  CmsContent: makeEntityClient('CmsContent'),
  Admissions: makeEntityClient('Admissions'),
};

export const base44 = {
  auth,
  functions,
  entities,
};
