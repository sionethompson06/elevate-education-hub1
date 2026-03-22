import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { FileText, Download, BookOpen, Activity, Home, GraduationCap, Users, Folder } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PROGRAM_CONFIG = {
  academic: { label: "Academic Program", icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
  homeschool: { label: "Homeschool Support", icon: Home, color: "text-purple-600", bg: "bg-purple-50" },
  athletic: { label: "Athletic Performance", icon: Activity, color: "text-orange-600", bg: "bg-orange-50" },
  college_readiness: { label: "Recruitment & College Readiness", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50" },
  family: { label: "Family Resource Center", icon: Users, color: "text-pink-600", bg: "bg-pink-50" },
  general: { label: "General", icon: Folder, color: "text-slate-600", bg: "bg-slate-50" },
};

const CATEGORY_LABELS = {
  form: "Form",
  resource: "Resource",
  policy: "Policy",
  report: "Report",
  curriculum: "Curriculum",
  announcement: "Announcement",
};

const CATEGORY_COLORS = {
  form: "bg-yellow-100 text-yellow-700",
  resource: "bg-blue-100 text-blue-700",
  policy: "bg-slate-100 text-slate-600",
  report: "bg-green-100 text-green-700",
  curriculum: "bg-purple-100 text-purple-700",
  announcement: "bg-red-100 text-red-700",
};

export default function Resources() {
  const { user } = useAuth();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", user?.role],
    queryFn: async () => {
      const visMap = {
        student: ["public", "student"],
        parent: ["public", "student", "parent"],
        academic_coach: ["public", "student", "parent", "coach"],
        performance_coach: ["public", "student", "parent", "coach"],
        admin: ["public", "student", "parent", "coach", "admin"],
      };
      const allowed = visMap[user?.role] || ["public"];
      // Fetch general shared docs (no student_id)
      const all = await base44.entities.Document.filter({}, "-created_date", 100);
      return all.filter(d => !d.student_id && allowed.includes(d.visibility));
    },
    enabled: !!user,
  });

  // Group by program_type
  const grouped = docs.reduce((acc, d) => {
    const pt = d.program_type || "general";
    if (!acc[pt]) acc[pt] = [];
    acc[pt].push(d);
    return acc;
  }, {});

  const orderedTypes = ["academic", "homeschool", "athletic", "college_readiness", "family", "general"];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Resource Center</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Program Resources</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No resources available yet.</p>
            <p className="text-xs text-slate-300 mt-1">Coaches and admins will post resources here.</p>
          </CardContent>
        </Card>
      ) : (
        orderedTypes.filter(pt => grouped[pt]?.length > 0).map(pt => {
          const cfg = PROGRAM_CONFIG[pt];
          const Icon = cfg.icon;
          return (
            <div key={pt}>
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${cfg.bg} w-fit`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {grouped[pt].map(d => (
                  <Card key={d.id} className="border border-slate-100 hover:shadow-sm transition-shadow">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[d.category] || "bg-slate-100 text-slate-600"}`}>
                              {CATEGORY_LABELS[d.category] || d.category}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800 text-sm">{d.title}</p>
                          {d.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.description}</p>}
                        </div>
                        {d.file_url && (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <button className="p-2 rounded-lg bg-slate-100 hover:bg-[#1a3c5e] hover:text-white transition-colors text-slate-600">
                              <Download className="w-4 h-4" />
                            </button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}