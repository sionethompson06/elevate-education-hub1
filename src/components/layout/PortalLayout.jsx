import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";
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
    { label: "Dashboard", href: "/student/dashboard" },
    { label: "My Lessons", href: "/student/lessons" },
    { label: "My Rewards", href: "/student/rewards" },
  ],
  parent: [
    { label: "Dashboard", href: "/parent/dashboard" },
    { label: "My Students", href: "/parent/students" },
    { label: "Billing", href: "/parent/billing" },
  ],
  academic_coach: [
    { label: "Dashboard", href: "/academic-coach/dashboard" },
    { label: "My Students", href: "/academic-coach/students" },
    { label: "Lessons", href: "/academic-coach/lessons" },
  ],
  performance_coach: [
    { label: "Dashboard", href: "/performance-coach/dashboard" },
    { label: "My Athletes", href: "/performance-coach/students" },
    { label: "Training Plans", href: "/performance-coach/lessons" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Users", href: "/admin/users" },
    { label: "Enrollments", href: "/admin/enrollments" },
    { label: "Payments", href: "/admin/payments" },
    { label: "CMS Editor", href: "/admin/cms" },
    { label: "Access Logs", href: "/admin/access-logs" },
    { label: "Audit Logs", href: "/admin/audit-logs" },
  ],
};

export default function PortalLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role || "student";
  const navItems = ROLE_NAV[role] || [];
  const roleColor = ROLE_COLORS[role] || "bg-[#1a3c5e]";
  const roleLabel = ROLE_LABELS[role] || role;

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

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ label, href }) => (
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
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
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
        <div className="md:hidden fixed inset-0 z-40 bg-[#1a3c5e] text-white pt-16 px-6 pb-6">
          <nav className="space-y-1">
            {navItems.map(({ label, href }) => (
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
            ))}
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