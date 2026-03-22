import { useAuth } from "@/lib/AuthContext";
import { getDashboardForRole } from "@/lib/rbac";
import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldOff className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h1>
        <p className="text-slate-500 mb-6">
          You don't have permission to view this page. You've been redirected to your permitted portal.
        </p>
        {user ? (
          <Link to={getDashboardForRole(user.role)}>
            <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]">Go to My Dashboard</Button>
          </Link>
        ) : (
          <Link to="/">
            <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]">Go to Home</Button>
          </Link>
        )}
      </div>
    </div>
  );
}