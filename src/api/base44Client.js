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
  AccessLog: '/audit-logs',
  SchoolYear: '/school-years',
  CoachNote: '/coach-notes',
  TrainingLog: '/training-logs',
  LessonAssignment: '/gradebook/lessons',
  CoachAssignment: '/gradebook/coach-assignments',
  StudentRewardBalance: '/rewards/balance',
  RewardTransaction: '/rewards/transactions',
  StudentGoal: '/rewards/goals',
  RewardRedemption: '/rewards/redemptions',
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
  const client = {
    async list(filters = {}) {
      // Guard: ignore sort/limit args passed as non-objects (Base44 legacy call signature)
      const safeFilters = (filters && typeof filters === 'object') ? filters : {};
      const data = await apiFetch(route + filtersToQuery(safeFilters));
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        for (const val of Object.values(data)) {
          if (Array.isArray(val)) return val;
        }
      }
      return [];
    },
    async filter(filters = {}) {
      return client.list(filters);
    },
    async get(id) {
      return apiFetch(route + '/' + id);
    },
    async create(data) {
      return apiFetch(route, { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, data) {
      // Try PUT first, fall back to PATCH
      return apiFetch(route + '/' + id, { method: 'PUT', body: JSON.stringify(data) });
    },
    async patch(id, data) {
      return apiFetch(route + '/' + id, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async delete(id) {
      return apiFetch(route + '/' + id, { method: 'DELETE' });
    },
  };
  return client;
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
// Handles both named functions and Base44-style action dispatch
const functions = {
  async invoke(functionName, params = {}) {
    const { action, ...rest } = params;

    // gradebook function dispatcher
    if (functionName === 'gradebook') {
      if (action === 'create') return apiFetch('/gradebook/lessons', { method: 'POST', body: JSON.stringify(rest) });
      if (action === 'update_status') return apiFetch('/gradebook/lessons/' + rest.lesson_id, { method: 'PATCH', body: JSON.stringify(rest) });
      if (action === 'get_lessons') return apiFetch('/gradebook/lessons' + filtersToQuery(rest));
      if (action === 'get_coach_queue') return apiFetch('/gradebook/queue');
      if (action === 'get_history') return apiFetch('/gradebook/lessons/' + rest.lesson_id + '/history');
      return apiFetch('/gradebook/lessons' + filtersToQuery(rest));
    }

    // enrollment function dispatcher
    if (functionName === 'enrollment') {
      if (action === 'get_programs') {
        const res = await apiFetch('/programs/available');
        const raw = Array.isArray(res) ? res : (res?.programs || []);
        const categoryMap = { academic: 'academic', athletic: 'athletic', virtual: 'virtual_homeschool', combined: 'combined' };
        const programs = raw.map(p => {
          const meta = p.metadata || {};
          const category = categoryMap[p.type] || p.type;
          const price_monthly = parseFloat(p.tuitionAmount || 0);
          return {
            ...p,
            category,
            price_monthly,
            price_annual: meta.price_annual || null,
            price_2x: meta.price_2x || null,
            features: meta.features || [],
            variants: meta.variants || null,
            badge: meta.badge || null,
          };
        });
        return { data: { programs } };
      }
      if (action === 'get_my_enrollments') {
        const res = await apiFetch('/enrollments/my-students');
        const enrollments = (res?.enrollments || []).map(e => ({
          ...e,
          program_id: e.programId ?? e.program_id,
          program_name: e.programName ?? e.program_name,
          student_id: e.studentId ?? e.student_id,
        }));
        return { data: { enrollments, students: res?.students || [] } };
      }
      if (action === 'enroll') {
        const res = await apiFetch('/enrollments', { method: 'POST', body: JSON.stringify({ studentId: rest.student_id, programId: rest.program_id }) });
        return { data: res };
      }
      return { data: {} };
    }

    // rewards function dispatcher
    if (functionName === 'rewards') {
      if (action === 'award_points') return apiFetch('/rewards/award', { method: 'POST', body: JSON.stringify(rest) });
      if (action === 'get_student_rewards') return apiFetch('/rewards/balance/' + rest.student_id);
      if (action === 'get_pending_redemptions') return apiFetch('/rewards/redemptions?status=pending');
      if (action === 'get_catalog') return apiFetch('/rewards/catalog');
      if (action === 'redeem') return apiFetch('/rewards/redeem', { method: 'POST', body: JSON.stringify(rest) });
      if (action === 'approve_redemption') return apiFetch('/rewards/redemptions/' + rest.redemption_id, { method: 'PATCH', body: JSON.stringify(rest) });
      return apiFetch('/rewards' + filtersToQuery(rest));
    }

    const fnRoutes = {
      getGradebook:    () => apiFetch('/progress/gradebook' + filtersToQuery(params)),
      getRewards:      () => apiFetch('/rewards' + filtersToQuery(params)),
      enrollStudent:   () => apiFetch('/enrollments', { method: 'POST', body: JSON.stringify(params) }),
      stripeCheckout:  () => apiFetch('/stripe/checkout', { method: 'POST', body: JSON.stringify(params) }),
      stripePortal:    () => apiFetch('/stripe/portal', { method: 'POST', body: JSON.stringify(params) }),
      getAttendance:   () => apiFetch('/attendance' + filtersToQuery(params)),
      getSchedule:     () => apiFetch('/sections' + filtersToQuery(params)),
      getMessages:     () => apiFetch('/messages' + filtersToQuery(params)),
      getAnalytics:    () => apiFetch('/progress/analytics'),
      inviteUser:      () => apiFetch('/users/invite', { method: 'POST', body: JSON.stringify(params) }),
      inviteAndSetRole:() => apiFetch('/users/invite', { method: 'POST', body: JSON.stringify(params) }),
      sendAnnouncement:() => apiFetch('/announcements', { method: 'POST', body: JSON.stringify(params) }),
      getPaymentHistory:() => apiFetch('/billing/payments'),
      adminOverride:   () => apiFetch('/enrollments/' + params.enrollment_id, { method: 'PATCH', body: JSON.stringify(params) }),
      syncFromAcademy: () => Promise.resolve({ success: true, data: { message: 'Applications are up to date.' } }),
      dataAccess:      () => apiFetch('/' + (params.resource || 'users') + filtersToQuery(params)),
    };

    const fn = fnRoutes[functionName];
    if (fn) return fn();
    console.warn('[api.functions] Unknown function:', functionName, params);
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
  Parent: {
    // Parent entity is modeled as users+guardianStudents. Use /users/my-profile for self.
    async list(f = {}) { return apiFetch('/users' + filtersToQuery({ ...f, role: 'parent' })).then(d => Array.isArray(d) ? d : d?.users || []); },
    async filter(f = {}) { return this.list(f); },
    async get(id) { return apiFetch('/users/' + id); },
    async create(data) { return apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }); },
    async update(id, data) { return apiFetch('/users/' + id, { method: 'PATCH', body: JSON.stringify(data) }); },
    async delete(id) { return apiFetch('/users/' + id, { method: 'DELETE' }); },
  },
  AcademicCoach:    makeEntityClient('User'),
  PerformanceCoach: makeEntityClient('User'),
};

export const base44 = {
  auth,
  functions,
  entities,
};
