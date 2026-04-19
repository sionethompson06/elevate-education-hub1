import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { apiPost, setAuthToken } from "@/api/apiClient";
import { BookOpen, Users, GraduationCap, Activity, ShieldCheck, Loader2 } from "lucide-react";

const PORTALS = [
  {
    label: "Admin",
    email: "admin@elevateperformance-academy.com",
    icon: ShieldCheck,
    description: "Full system control — users, enrollments, analytics",
    color: "from-red-500 to-rose-600",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    route: "/admin/dashboard",
  },
  {
    label: "Parent",
    email: "sarah.johnson@example.com",
    icon: Users,
    description: "Student overview, billing, program enrollment",
    color: "from-purple-500 to-violet-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    route: "/parent/dashboard",
  },
  {
    label: "Student",
    email: "ethan.johnson@example.com",
    icon: BookOpen,
    description: "Schedule, progress, assignments, rewards",
    color: "from-blue-500 to-cyan-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    route: "/student/dashboard",
  },
  {
    label: "Academic Coach",
    email: "coach.martinez@elevateperformance-academy.com",
    icon: GraduationCap,
    description: "Student roster, assignments, attendance",
    color: "from-emerald-500 to-green-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    route: "/academic-coach/dashboard",
  },
  {
    label: "Performance Coach",
    email: "coach.williams@elevateperformance-academy.com",
    icon: Activity,
    description: "Training logs, athlete performance, scheduling",
    color: "from-orange-500 to-amber-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    route: "/performance-coach/dashboard",
  },
];

export default function Login() {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const { setUser, setIsAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const enter = async (portal) => {
    setError("");
    setLoading(portal.email);
    try {
      const res = await apiPost('/auth/dev-login', { email: portal.email });
      setAuthToken(res.token);
      setUser(res.user);
      setIsAuthenticated(true);
      const from = searchParams.get("from");
      navigate((from && from.startsWith("/") && !from.startsWith("//")) ? from : portal.route, { replace: true });
    } catch (err) {
      setError(err.message || "Could not connect. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const sessionExpired = searchParams.get("session_expired") === "1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2540] via-[#1a3c5e] to-[#0f2540] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {sessionExpired && (
          <div className="mb-6 bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-xl px-5 py-3 text-center font-medium">
            Your session has expired. Please sign in again.
          </div>
        )}
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-4 tracking-wide uppercase">
            Portal Preview
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Elevate Education Hub</h1>
          <p className="text-blue-200 text-lg">Select a portal to enter</p>
        </div>

        {/* Portal cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {PORTALS.map((portal) => {
            const Icon = portal.icon;
            const isLoading = loading === portal.email;
            return (
              <button
                key={portal.email}
                onClick={() => enter(portal)}
                disabled={loading !== null}
                className={`group relative text-left rounded-2xl border-2 ${portal.border} bg-white p-6 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${portal.color} flex items-center justify-center mb-4 shadow-md`}>
                  {isLoading
                    ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                    : <Icon className="w-6 h-6 text-white" />
                  }
                </div>
                <div className={`text-xs font-bold uppercase tracking-widest ${portal.text} mb-1`}>
                  {portal.label}
                </div>
                <p className="text-slate-500 text-sm leading-snug">{portal.description}</p>
                <div className={`absolute bottom-4 right-4 text-xs font-semibold ${portal.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  Enter →
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 bg-red-900/40 border border-red-400/30 rounded-xl p-3 text-center text-red-200 text-sm">
            {error}
          </div>
        )}

        <p className="text-center text-blue-300/50 text-xs mt-6">
          Demo environment — no password required
        </p>
      </div>
    </div>
  );
}
