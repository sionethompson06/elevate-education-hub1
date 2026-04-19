import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { FileText, Download, BookOpen, Activity, Video, Link2, Folder } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const TYPE_CONFIG = {
  document: { label: "Document", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  video: { label: "Video", icon: Video, color: "text-purple-600", bg: "bg-purple-50" },
  link: { label: "Link", icon: Link2, color: "text-green-600", bg: "bg-green-50" },
};

const SUBJECT_ICONS = {
  Math: BookOpen,
  English: BookOpen,
  Science: BookOpen,
  PE: Activity,
};

export default function Resources() {
  const { user } = useAuth();

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["my-resources", user?.id],
    queryFn: () => apiGet("/resources/my").then(r => r.resources || []),
    enabled: !!user,
  });

  // Group by subjectArea
  const grouped = resources.reduce((acc, r) => {
    const key = r.subjectArea || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const subjects = Object.keys(grouped).sort();

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
      ) : resources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No resources available yet.</p>
            <p className="text-xs text-slate-300 mt-1">Coaches and admins will post resources here.</p>
          </CardContent>
        </Card>
      ) : (
        subjects.map(subject => {
          const SubjectIcon = SUBJECT_ICONS[subject] || Folder;
          return (
            <div key={subject}>
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-slate-50 w-fit">
                <SubjectIcon className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-600">{subject}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {grouped[subject].map(r => {
                  const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.document;
                  const TypeIcon = cfg.icon;
                  const href = r.externalUrl || r.filePath;
                  return (
                    <Card key={r.id} className="border border-slate-100 hover:shadow-sm transition-shadow">
                      <CardContent className="py-4 px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                              <TypeIcon className={`w-4 h-4 ${cfg.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm">{r.title}</p>
                              {r.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>
                              )}
                              <span className={`text-xs font-medium ${cfg.color} mt-1 block`}>{cfg.label}</span>
                            </div>
                          </div>
                          {href && (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <button className="p-2 rounded-lg bg-slate-100 hover:bg-[#1a3c5e] hover:text-white transition-colors text-slate-600">
                                <Download className="w-4 h-4" />
                              </button>
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
