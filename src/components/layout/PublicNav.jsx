import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { GraduationCap, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { getDashboardForRole } from "@/lib/rbac";

export default function PublicNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Academics", href: "/academics" },
    { label: "Athletics", href: "/athletics" },
    { label: "Virtual Homeschool", href: "/virtual-homeschool" },
    { label: "College & NIL", href: "/college-nil" },
    { label: "Admissions", href: "/admissions" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ];

  const isActive = (href) => location.pathname === href;

  return (
    <nav className="bg-[#0A0F1A] text-white sticky top-0 z-50 shadow-lg border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <GraduationCap className="w-6 h-6 text-[#3B82F6]" />
          <span className="hidden sm:inline bg-gradient-to-r from-[#3B82F6] to-[#10B981] bg-clip-text text-transparent font-black tracking-tight">
            ELEVATE PERFORMANCE ACADEMY
          </span>
          <span className="sm:hidden bg-gradient-to-r from-[#3B82F6] to-[#10B981] bg-clip-text text-transparent font-black">
            ELEVATE
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map(({ label, href }) => (
            <Link
              key={href}
              to={href}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(href)
                  ? "bg-white/10 text-white font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <Link to={getDashboardForRole(user.role)}>
              <Button size="sm" className="bg-[#10B981] text-white hover:bg-[#059669] font-semibold">
                My Portal
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:inline">
                Sign In
              </Link>
              <Link to="/apply">
                <Button size="sm" className="bg-[#10B981] text-white hover:bg-[#059669] font-semibold">
                  APPLY NOW
                </Button>
              </Link>
            </>
          )}
          <button
            className="lg:hidden p-2 rounded-md hover:bg-white/10"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/5 px-6 pb-4">
          {navLinks.map(({ label, href }) => (
            <Link
              key={href}
              to={href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm text-slate-400 hover:text-white border-b border-white/5 last:border-0"
            >
              {label}
            </Link>
          ))}
          <Link to="/login" onClick={() => setMobileOpen(false)} className="block py-3 text-sm text-slate-400 hover:text-white">
            Sign In
          </Link>
        </div>
      )}
    </nav>
  );
}
