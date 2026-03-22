import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getDashboardForRole } from "@/lib/rbac";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  // If already signed in, send to their dashboard immediately
  useEffect(() => {
    if (!isLoadingAuth && user?.role) {
      navigate(getDashboardForRole(user.role), { replace: true });
    }
  }, [user, isLoadingAuth]);

  const handleSignIn = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#0f1923" }}
    >
      {/* Subtle background gradient orbs */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #00bcd4, transparent)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #00e676, transparent)" }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-8 flex flex-col items-center gap-6"
        style={{ backgroundColor: "#151f2e", border: "1px solid #1e2d40" }}
      >
        {/* Logo mark */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black tracking-tight"
          style={{ backgroundColor: "#00bcd4", color: "#0f1923" }}
        >
          EPA
        </div>

        {/* Brand */}
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#00bcd4" }}>
            Elevate Performance Academy
          </p>
          <h1 className="text-2xl font-black text-white leading-tight">
            Staff & Family Portal
          </h1>
          <p className="text-sm mt-2" style={{ color: "#6b7f96" }}>
            Sign in to access your portal — students, parents, coaches, and administrators.
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ backgroundColor: "#1e2d40" }} />

        {/* Sign In Button */}
        <Button
          onClick={handleSignIn}
          className="w-full py-3 text-sm font-bold tracking-wide rounded-lg transition-all"
          style={{ backgroundColor: "#00bcd4", color: "#0f1923" }}
        >
          SIGN IN
        </Button>

        {/* Role chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {["Students", "Parents", "Academic Coaches", "Performance Coaches", "Admins"].map((r) => (
            <span
              key={r}
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: "#1e2d40", color: "#6b7f96" }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs" style={{ color: "#3a4f63" }}>
        © 2026 Elevate Performance Academy. All rights reserved.
      </p>
    </div>
  );
}