import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Users, DollarSign, ShieldCheck, FileText, BookOpen, Activity, Star, MessageCircle, TrendingUp, GraduationCap, Home, Trophy, ChevronRight, Database, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const QUICK_LINKS = [
  { label: "Parents & Guardians", href: "/admin/parents", description: "Edit parent profiles & link students", icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "Users & Roles", href: "/admin/users", description: "Manage user roles & coach profiles", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
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
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const { data: enrollmentsData = { enrollments: [] } } = useQuery({
    queryKey: ["admin-enrollment-count"],
    queryFn: () => apiGet('/enrollments'),
  });

  const { data: studentsData = { students: [] } } = useQuery({
    queryKey: ["admin-students-count"],
    queryFn: () => apiGet('/students'),
  });

  const { data: usersData = { users: [] } } = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: () => apiGet('/users'),
  });

  const seedDemoData = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await apiPost('/admin/seed-demo-data', {});
      setSeedResult({ success: true, items: result.seeded });
    } catch (err) {
      setSeedResult({ success: false, error: err.message });
    } finally {
      setSeeding(false);
    }
  };

  const allEnrollments = enrollmentsData.enrollments || [];
  const activeEnrollments = allEnrollments.filter(e => ["active", "active_override"].includes(e.status));
  const pendingEnrollments = allEnrollments.filter(e => ["pending_payment", "pending"].includes(e.status));
  const totalStudents = (studentsData.students || []).length;
  const totalUsers = (usersData.users || []).length;

  const stats = [
    { icon: Users, label: "Active Enrollments", value: activeEnrollments.length, color: "text-blue-600" },
    { icon: DollarSign, label: "Pending Payments", value: pendingEnrollments.length, color: "text-yellow-500" },
    { icon: GraduationCap, label: "Total Students", value: totalStudents, color: "text-green-600" },
    { icon: TrendingUp, label: "Total Users", value: totalUsers, color: "text-purple-600" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">{user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email} — Elevate Education Hub Control Panel</p>
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
            <div key={label} className="rounded-xl border border-slate-100 p-4 text-center">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-xs font-semibold text-slate-700 leading-tight">{label}</p>
              <p className="text-xs text-green-600 font-medium mt-1">Active</p>
            </div>
          ))}
        </div>
      </div>

      {/* Portal Hub access */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">View Portal Hubs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Student Hub", desc: "View the student portal experience", href: "/student/dashboard", icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Parent Hub", desc: "View the parent portal experience", href: "/parent/dashboard", icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Coach Hub", desc: "View the academic coach experience", href: "/academic-coach/dashboard", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map(({ label, desc, href, icon: Icon, color, bg }) => (
            <Link key={href} to={href}>
              <Card className="hover:shadow-md hover:border-[#1a3c5e] transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <CardTitle className="text-sm text-[#1a3c5e]">{label}</CardTitle>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">{desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Demo data seed */}
      <div className="rounded-xl border border-dashed border-slate-300 p-5 bg-slate-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Demo Data Setup</h2>
            </div>
            <p className="text-xs text-slate-500">Seeds coach assignments, lessons, reward catalog, and points for demo accounts. Safe to run multiple times — skips existing data.</p>
          </div>
          <Button size="sm" variant="outline" onClick={seedDemoData} disabled={seeding} className="shrink-0">
            {seeding ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Database className="w-4 h-4 mr-1" />}
            Seed Demo Data
          </Button>
        </div>
        {seedResult && (
          <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${seedResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {seedResult.success ? (
              <ul className="space-y-0.5">
                {seedResult.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 shrink-0" /> {item}</li>
                ))}
              </ul>
            ) : (
              <span>{seedResult.error}</span>
            )}
          </div>
        )}
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
