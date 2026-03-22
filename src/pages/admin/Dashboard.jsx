import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, DollarSign, ShieldCheck, FileText, BookOpen, Activity, Star, MessageCircle, TrendingUp, GraduationCap, Home, Trophy, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK_LINKS = [
  { label: "Admissions", href: "/admin/admissions", description: "Review and process applications", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Enrollments", href: "/admin/enrollments", description: "Manage enrollments & payment overrides", icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
  { label: "Rewards", href: "/admin/rewards", description: "Redemption queue, catalog, transactions", icon: Star, color: "text-yellow-600", bg: "bg-yellow-50" },
  { label: "Messages", href: "/admin/messages", description: "Broadcast announcements & channel messages", icon: MessageCircle, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Resources", href: "/admin/resources", description: "Manage program resources & documents", icon: BookOpen, color: "text-orange-600", bg: "bg-orange-50" },
  { label: "Access Logs", href: "/admin/access-logs", description: "Review denied access attempts", icon: ShieldCheck, color: "text-red-600", bg: "bg-red-50" },
  { label: "CMS Editor", href: "/admin/cms", description: "Edit public-facing site content", icon: GraduationCap, color: "text-slate-600", bg: "bg-slate-100" },
];

const PROGRAMS = [
  { label: "Academic Program", icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Homeschool Support", icon: Home, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Athletic Performance", icon: Activity, color: "text-orange-600", bg: "bg-orange-50" },
  { label: "Recruitment & College", icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Family Resource Center", icon: Users, color: "text-pink-600", bg: "bg-pink-50" },
];

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-enrollment-count"],
    queryFn: () => base44.entities.Enrollment.filter({ status: "active" }),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["admin-pending-apps"],
    queryFn: () => base44.entities.Application.filter({ status: "submitted" }),
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ["admin-pending-redemptions"],
    queryFn: () => base44.functions.invoke("rewards", { action: "get_pending_redemptions" }).then(r => r.data?.redemptions || []),
  });

  const stats = [
    { icon: Users, label: "Active Enrollments", value: enrollments.length, color: "text-blue-600" },
    { icon: FileText, label: "Pending Applications", value: applications.length, color: "text-yellow-500" },
    { icon: Star, label: "Pending Redemptions", value: redemptions.length, color: "text-purple-600" },
    { icon: TrendingUp, label: "Programs Active", value: 5, color: "text-green-600" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">{user?.full_name} — Elevate Education Hub Control Panel</p>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
              <Icon className={`w-5 h-5 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-800">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 5 Program hubs status */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">5 Core Program Hubs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {PROGRAMS.map(({ label, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl border border-slate-100 p-4 text-center`}>
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-xs font-semibold text-slate-700 leading-tight">{label}</p>
              <p className="text-xs text-green-600 font-medium mt-1">Active</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_LINKS.map(({ label, href, description, icon: Icon, color, bg }) => (
            <Link key={href} to={href}>
              <Card className="hover:shadow-md hover:border-[#1a3c5e] transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <CardTitle className="text-sm text-[#1a3c5e]">{label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">{description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}