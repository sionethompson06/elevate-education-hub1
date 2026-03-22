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
  ];

  const isActive = (href) => location.pathname === href;

  return (
    <nav className="bg-[#1a3c5e] text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <GraduationCap className="w-6 h-6 text-yellow-400" />
          <span className="hidden sm:inline">Elevate Education Hub</span>
          <span className="sm:hidden">Elevate</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map(({ label, href }) => (
            <Link
              key={href}
              to={href}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(href)
                  ? "bg-white/20 text-white font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <Link to={getDashboardForRole(user.role)}>
              <Button size="sm" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-semibold">
                My Portal
              </Button>
            </Link>
          ) : (
            <Link to="/apply">
              <Button size="sm" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-semibold">
                Apply Now
              </Button>
            </Link>
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
        <div className="lg:hidden border-t border-white/10 px-6 pb-4">
          {navLinks.map(({ label, href }) => (
            <Link
              key={href}
              to={href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm text-slate-300 hover:text-white border-b border-white/5 last:border-0"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}