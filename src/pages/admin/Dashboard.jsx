import { useAuth } from "@/lib/AuthContext";
import { Users, DollarSign, ShieldCheck, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const { user } = useAuth();

  const quickLinks = [
    { label: "User Management", href: "/admin/users", description: "Manage all users and roles" },
    { label: "Enrollments", href: "/admin/enrollments", description: "View and manage enrollments" },
    { label: "Payment Overrides", href: "/admin/payment-overrides", description: "Override payments with audit trail" },
    { label: "Access Logs", href: "/admin/access-logs", description: "Review denied access attempts" },
    { label: "CMS", href: "/admin/cms", description: "Edit public site content" },
    { label: "Reports", href: "/admin/reports", description: "KPI and performance reports" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">
            Admin
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Admin Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            {user?.full_name} — Elevate Education Hub Control Panel
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: "Total Users", value: "—", color: "text-blue-600" },
            { icon: DollarSign, label: "Active Enrollments", value: "—", color: "text-green-600" },
            { icon: ShieldCheck, label: "Overrides Pending", value: "—", color: "text-yellow-500" },
            { icon: FileText, label: "Access Denials (24h)", value: "—", color: "text-red-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                <Icon className={`w-5 h-5 ${color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map(({ label, href, description }) => (
            <Link key={href} to={href}>
              <Card className="hover:shadow-md hover:border-[#1a3c5e] transition-all cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-base text-[#1a3c5e]">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">{description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}