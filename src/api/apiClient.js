// Centralized HTTP client — wraps fetch with JWT auth, JSON parsing, and error handling.
// Use this for direct API calls from pages/components instead of going through base44Client.

const TOKEN_KEY = 'elevate_auth_token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('elevate_auth_user');
}

async function request(method, path, body) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearAuthToken();
    const data = await res.json().catch(() => ({}));
    // Only redirect to login if we're not already there (avoids reload loop on bad credentials)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Session expired');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export const apiGet    = (path) => request('GET', path);
export const apiPost   = (path, body) => request('POST', path, body);
export const apiPatch  = (path, body) => request('PATCH', path, body);
export const apiPut    = (path, body) => request('PUT', path, body);
export const apiDelete = (path) => request('DELETE', path);
