import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { checkRouteAccess, getDashboardForRole } from "@/lib/rbac";
import { base44 } from "@/api/base44Client";

/**
 * Wraps protected routes. Checks role access on every navigation.
 * Logs denied attempts to AccessLog entity.
 */
export default function RBACGuard({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoadingAuth) return;

    const role = user?.role || null;
    const pathname = location.pathname;
    const { allowed, reason } = checkRouteAccess(role, pathname);

    if (!allowed) {
      // Log the denied access attempt (silent fail)
      base44.entities.AccessLog.create({
        user_id: user?.id || "anonymous",
        user_email: user?.email || "anonymous",
        user_role: role || "none",
        attempted_route: pathname,
        action: "denied",
        reason,
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      if (!role) {
        navigate("/login", { replace: true });
      } else {
        navigate(getDashboardForRole(role), { replace: true });
      }
    }
  }, [user, isLoadingAuth, location.pathname]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
