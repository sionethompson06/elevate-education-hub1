import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { apiGet, apiPost, setAuthToken } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useAuth();

  const [inviteInfo, setInviteInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid invitation link."); setLoading(false); return; }
    apiGet(`/auth/verify-invite?token=${encodeURIComponent(token)}`)
      .then(data => { setInviteInfo(data.user); setLoading(false); })
      .catch(err => { setError(err.message || "Invalid or expired link."); setLoading(false); });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError("");
    setSubmitting(true);
    try {
      const { token: jwt, user } = await apiPost("/auth/register-invite", { token, password });
      setAuthToken(jwt);
      setUser(user);
      setIsAuthenticated(true);
      const routes = { admin: "/admin/dashboard", student: "/student/dashboard", parent: "/parent/dashboard", "academic-coach": "/academic-coach/dashboard", "performance-coach": "/performance-coach/dashboard" };
      navigate(routes[user.role] || "/", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to set up account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a3c5e] to-[#0f2540] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Elevate Education Hub</h1>
          <p className="text-blue-200 mt-2">Set up your account</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create Your Password</CardTitle>
            {inviteInfo && <CardDescription>Welcome, {inviteInfo.firstName}! Set a password for {inviteInfo.email}.</CardDescription>}
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 special" required />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
                </div>
                <Button type="submit" className="w-full bg-[#1a3c5e] hover:bg-[#0f2540]" disabled={submitting}>
                  {submitting ? "Setting up..." : "Create Account & Sign In"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
