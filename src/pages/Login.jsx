import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser, setIsAuthenticated, checkAppState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await base44.auth.login(email, password);
      setUser(user);
      setIsAuthenticated(true);
      const from = searchParams.get("from");
      if (from) {
        window.location.href = from;
      } else {
        // Redirect based on role
        const roleRoutes = {
          admin: "/admin/dashboard",
          student: "/student/dashboard",
          parent: "/parent/dashboard",
          academic_coach: "/academic-coach/dashboard",
          performance_coach: "/performance-coach/dashboard",
        };
        navigate(roleRoutes[user.role] || "/", { replace: true });
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const demoLogins = [
    { label: "Admin", email: "admin@elevate.edu", hint: "admin" },
    { label: "Student", email: "student@elevate.edu", hint: "student" },
    { label: "Parent", email: "parent@elevate.edu", hint: "parent" },
    { label: "Academic Coach", email: "coach@elevate.edu", hint: "academic_coach" },
    { label: "Performance Coach", email: "performance@elevate.edu", hint: "performance_coach" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a3c5e] to-[#0f2540] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Elevate Education Hub</h1>
          <p className="text-blue-200 mt-2">Sign in to your portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full bg-[#1a3c5e] hover:bg-[#0f2540]" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 border-t pt-4">
              <p className="text-xs text-slate-500 mb-3 text-center">Quick demo access — click any role:</p>
              <div className="grid grid-cols-2 gap-2">
                {demoLogins.map((d) => (
                  <Button
                    key={d.label}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword("demo");
                    }}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
