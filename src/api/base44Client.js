// Real API client — replaces Base44 SDK with calls to the Express/PostgreSQL backend.
// Maintains the same interface (base44.auth, base44.entities, base44.functions)
// so existing components continue to work without changes.

const TOKEN_KEY = 'elevate_auth_token';
const USER_KEY = 'elevate_auth_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Entity name -> API route mapping
const ENTITY_ROUTES = {
  User: '/users',
  Student: '/students',
  Enrollment: '/enrollments',
  Program: '/programs',
  Section: '/sections',
  Attendance: '/attendance',
  Grade: '/assignments',
  Reward: '/rewards',
  Message: '/messages',
  Resource: '/resources',
  Schedule: '/sections',
  Payment: '/billing/payments',
  Invoice: '/billing/invoices',
  CmsContent: '/cms',
  Admissions: '/applications',
  AccessLog: '/users/access-logs',
  SchoolYear: '/school-years',
  CoachNote: '/coach-notes',
  TrainingLog: '/training-logs',
  Announcement: '/announcements',
  Notification: '/notifications',
  Document: '/documents',
  StaffAssignment: '/staff-assignments',
};

function getRoute(entityName) {
  const route = ENTITY_ROUTES[entityName];
  if (!route) {
    console.warn('[api] No route mapped for entity:', entityName);
    return '/' + entityName.toLowerCase() + 's';
  }
  return route;
}

function filtersToQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null) params.append(k, v);
  }
  const str = params.toString();
  return str ? '?' + str : '';
}

function makeEntityClient(entityName) {
  const route = getRoute(entityName);
  return {
    async list(filters = {}) {
      return apiFetch(route + filtersToQuery(filters));
    },
    async get(id) {
      return apiFetch(route + '/' + id);
    },
    async create(data) {
      return apiFetch(route, { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, data) {
      return apiFetch(route + '/' + id, { method: 'PUT', body: JSON.stringify(data) });
    },
    async delete(id) {
      return apiFetch(route + '/' + id, { method: 'DELETE' });
    },
  };
}

// Auth module
const auth = {
  async me() {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await apiFetch('/auth/me');
      // /api/auth/me returns { user: {...} }
      const user = res.user || res;
      if (!user || !user.id) { clearSession(); return null; }
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch {
      clearSession();
      return null;
    }
  },

  async login(email, password) {
    const { token, user } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  async logout() {
    clearSession();
  },

  redirectToLogin(returnUrl) {
    window.location.href = '/login' + (returnUrl ? '?from=' + encodeURIComponent(returnUrl) : '');
  },
};

// Functions module (server-side operations)
const functions = {
  async invoke(functionName, params = {}) {
    const fnRoutes = {
      getGradebook: () => apiFetch('/progress/gradebook' + filtersToQuery(params)),
      getRewards: () => apiFetch('/rewards' + filtersToQuery(params)),
      enrollStudent: () => apiFetch('/enrollments', { method: 'POST', body: JSON.stringify(params) }),
      stripeCheckout: () => apiFetch('/billing/checkout', { method: 'POST', body: JSON.stringify(params) }),
      getAttendance: () => apiFetch('/attendance' + filtersToQuery(params)),
      getSchedule: () => apiFetch('/sections' + filtersToQuery(params)),
      getMessages: () => apiFetch('/messages' + filtersToQuery(params)),
      getAnalytics: () => apiFetch('/progress/analytics'),
      inviteUser: () => apiFetch('/users/invite', { method: 'POST', body: JSON.stringify(params) }),
      sendAnnouncement: () => apiFetch('/announcements', { method: 'POST', body: JSON.stringify(params) }),
    };
    const fn = fnRoutes[functionName];
    if (fn) return fn();
    console.warn('[api.functions] Unknown function:', functionName);
    return {};
  },
};

// Entity clients
const entities = {
  AccessLog:        makeEntityClient('AccessLog'),
  User:             makeEntityClient('User'),
  Student:          makeEntityClient('Student'),
  Enrollment:       makeEntityClient('Enrollment'),
  Program:          makeEntityClient('Program'),
  Section:          makeEntityClient('Section'),
  Attendance:       makeEntityClient('Attendance'),
  Grade:            makeEntityClient('Grade'),
  Reward:           makeEntityClient('Reward'),
  Message:          makeEntityClient('Message'),
  Resource:         makeEntityClient('Resource'),
  Schedule:         makeEntityClient('Schedule'),
  Payment:          makeEntityClient('Payment'),
  Invoice:          makeEntityClient('Invoice'),
  CmsContent:       makeEntityClient('CmsContent'),
  Admissions:       makeEntityClient('Admissions'),
  SchoolYear:       makeEntityClient('SchoolYear'),
  CoachNote:        makeEntityClient('CoachNote'),
  TrainingLog:      makeEntityClient('TrainingLog'),
  Announcement:     makeEntityClient('Announcement'),
  Notification:     makeEntityClient('Notification'),
  Document:         makeEntityClient('Document'),
  StaffAssignment:  makeEntityClient('StaffAssignment'),
  // Legacy aliases
  Parent:           makeEntityClient('User'),
  AcademicCoach:    makeEntityClient('User'),
  PerformanceCoach: makeEntityClient('User'),
};

export const base44 = {
  auth,
  functions,
  entities,
};
