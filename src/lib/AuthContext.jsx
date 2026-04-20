import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiGet, apiPost, clearAuthToken, getAuthToken, setAuthToken } from '@/api/apiClient';

const AuthContext = createContext();

const IMPERSONATE_RETURN_KEY = 'elevate_impersonate_return';

function getDashboardForRole(role) {
  // Accepts both underscore and hyphen formats
  const r = role?.replace(/-/g, '_');
  if (r === 'parent') return '/parent/dashboard';
  if (r === 'student') return '/student/dashboard';
  if (r === 'academic_coach') return '/academic-coach/dashboard';
  if (r === 'performance_coach') return '/performance-coach/dashboard';
  return '/admin/dashboard';
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'elevate', public_settings: {} });
  const [isImpersonating, setIsImpersonating] = useState(
    () => !!localStorage.getItem(IMPERSONATE_RETURN_KEY)
  );

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const token = getAuthToken();
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      const data = await apiGet('/auth/me');
      if (data?.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        // Sync impersonation state from localStorage on (re)load
        setIsImpersonating(!!localStorage.getItem(IMPERSONATE_RETURN_KEY));
      } else {
        clearAuthToken();
        setIsAuthenticated(false);
      }
    } catch (error) {
      clearAuthToken();
      setIsAuthenticated(false);
      if (error.message !== 'Session expired') {
        setAuthError({ type: 'unknown', message: error.message || 'Failed to load app' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = async (shouldRedirect = true) => {
    if (localStorage.getItem(IMPERSONATE_RETURN_KEY)) {
      stopImpersonating();
      return;
    }
    try { await apiPost('/auth/logout'); } catch { /* ignore */ }
    clearAuthToken();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const impersonateUser = async (userId) => {
    const res = await apiPost(`/users/${userId}/impersonate`);
    localStorage.setItem(IMPERSONATE_RETURN_KEY, getAuthToken());
    setAuthToken(res.token);
    window.location.href = getDashboardForRole(res.user.role);
  };

  const stopImpersonating = () => {
    const adminToken = localStorage.getItem(IMPERSONATE_RETURN_KEY);
    if (!adminToken) return;
    localStorage.removeItem(IMPERSONATE_RETURN_KEY);
    setAuthToken(adminToken);
    window.location.href = '/admin/dashboard';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      setUser,
      setIsAuthenticated,
      isImpersonating,
      impersonateUser,
      stopImpersonating,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
