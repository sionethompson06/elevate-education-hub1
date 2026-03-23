import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { GraduationCap, LogOut, Menu, X, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";

const ROLE_COLORS = {
  student: "bg-blue-600",
  parent: "bg-purple-600",
  academic_coach: "bg-emerald-600",
  performance_coach: "bg-orange-600",
  admin: "bg-red-600",
};

const ROLE_NAV = {
  student: [
    { label: "My Dashboard", href: "/student/dashboard" },
    { label: "My Lessons", href: "/student/progress" },
    { label: "Schedule", href: "/student/schedule" },
    { label: "Attendance", href: "/student/attendance" },
    { label: "Messages", href: "/student/messages" },
    { label: "Resources", href: "/student/resources" },
    { label: "Rewards", href: "/student/rewards" },
  ],
  parent: [
    { label: "My Dashboard", href: "/parent/dashboard" },
    { label: "Programs & Enroll", href: "/parent/programs" },
    { label: "Payments & Billing", href: "/parent/payments" },
    { label: "Student Progress", href: "/parent/progress" },
    { label: "Schedule", href: "/parent/schedule" },
    { label: "Attendance", href: "/parent/attendance" },
    { label: "Messages", href: "/parent/messages" },
    { label: "Resources", href: "/parent/resources" },
  ],
  academic_coach: [
    { label: "My Dashboard", href: "/academic-coach/dashboard" },
    { label: "Schedule", href: "/academic-coach/schedule" },
    { label: "Attendance", href: "/academic-coach/attendance" },
    { label: "Messages", href: "/academic-coach/messages" },
    { label: "Resources", href: "/academic-coach/resources" },
    { label: "Rewards", href: "/academic-coach/rewards" },
  ],
  performance_coach: [
    { label: "My Dashboard", href: "/performance-coach/dashboard" },
    { label: "Schedule", href: "/performance-coach/schedule" },
    { label: "Attendance", href: "/performance-coach/attendance" },
    { label: "Messages", href: "/performance-coach/messages" },
    { label: "Resources", href: "/performance-coach/resources" },
    { label: "Rewards", href: "/performance-coach/rewards" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Users & Roles", href: "/admin/users" },
    { label: "Students", href: "/admin/students" },

    { label: "Admissions", href: "/admin/admissions" },
    { label: "Enrollments", href: "/admin/enrollments" },
    { label: "Attendance", href: "/admin/attendance" },
    { label: "Rewards", href: "/admin/rewards" },
    { label: "Messages", href: "/admin/messages" },
    { label: "Resources", href: "/admin/resources" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "CMS Editor", href: "/admin/cms" },
    { label: "Access Logs", href: "/admin/access-logs" },
    { label: "── View as Hub ──", href: null, divider: true },
    { label: "👨‍🎓 Student Hub", href: "/student/dashboard" },
    { label: "👨‍👩‍👧 Parent Hub", href: "/parent/dashboard" },
    { label: "🏫 Coach Hub", href: "/academic-coach/dashboard" },
  ],
};

export default function PortalLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role || "student";

  // If admin is browsing a non-admin hub, show that hub's nav + a back button
  const path = location.pathname;
  const isAdminViewingOtherHub = role === "admin" && !path.startsWith("/admin");
  const viewingHubRole = isAdminViewingOtherHub
    ? path.startsWith("/student") ? "student"
    : path.startsWith("/parent") ? "parent"
    : path.startsWith("/academic-coach") ? "academic_coach"
    : path.startsWith("/performance-coach") ? "performance_coach"
    : null
    : null;

  const effectiveRole = viewingHubRole || role;
  const navItems = ROLE_NAV[effectiveRole] || [];
  const roleColor = ROLE_COLORS[effectiveRole] || "bg-[#1a3c5e]";
  const roleLabel = ROLE_LABELS[effectiveRole] || effectiveRole;

  const isActive = (href) => location.pathname === href;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1a3c5e] text-white shrink-0">
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 font-bold text-sm text-white hover:text-yellow-300 transition-colors">
            <GraduationCap className="w-5 h-5 text-yellow-400" />
            Elevate Education Hub
          </Link>
          <div className={`mt-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${roleColor} text-white`}>
            {roleLabel}
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">{user?.full_name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ label, href, divider }) => {
            if (divider) return (
              <p key={label} className="text-xs text-slate-500 px-4 pt-3 pb-1 font-semibold tracking-wide">{label}</p>
            );
            return (
              <Link
                key={href}
                to={href}
                className={`flex items-center px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(href)
                    ? "bg-white/20 text-white font-semibold"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          {isAdminViewingOtherHub && (
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2 text-yellow-300 hover:text-yellow-200 text-sm w-full px-4 py-2 rounded-lg hover:bg-white/10 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin Hub
            </Link>
          )}
          <button
            onClick={() => base44.auth.logout("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-full px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 bg-[#1a3c5e] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-yellow-400" />
          <span className="font-bold text-sm">Elevate</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${roleColor} ml-1`}>
            {roleLabel}
          </span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#1a3c5e] text-white pt-16 px-6 pb-6 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map(({ label, href, divider }) => {
              if (divider) return (
                <p key={label} className="text-xs text-slate-500 px-4 pt-3 pb-1 font-semibold tracking-wide">{label}</p>
              );
              return (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 rounded-lg text-sm ${
                    isActive(href) ? "bg-white/20 font-semibold" : "text-slate-300"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {isAdminViewingOtherHub && (
              <Link
                to="/admin/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-yellow-300 font-semibold mt-4 border-t border-white/10 pt-4"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Admin Hub
              </Link>
            )}
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:overflow-auto md:h-screen pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}