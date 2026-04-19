import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { FileText, Download, BookOpen, Activity, Video, Link2, Folder, Plus, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

const STAFF_ROLES = ["admin", "academic_coach", "performance_coach"];

export default function Resources() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", type: "document", externalUrl: "", subjectArea: "" });
  const [uploadError, setUploadError] = useState(null);

  const isStaff = STAFF_ROLES.includes(user?.role);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["my-resources", user?.id],
    queryFn: () => (isStaff ? apiGet("/resources").then(r => r.resources || []) : apiGet("/resources/my").then(r => r.resources || [])),
    enabled: !!user,
  });

  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.title.trim()) { setUploadError("Title is required"); return; }
    setUploading(true);
    setUploadError(null);
    try {
      await apiPost("/resources", {
        title: uploadForm.title,
        description: uploadForm.description || undefined,
        type: uploadForm.type,
        externalUrl: uploadForm.externalUrl || undefined,
        subjectArea: uploadForm.subjectArea || undefined,
      });
      setShowUpload(false);
      setUploadForm({ title: "", description: "", type: "document", externalUrl: "", subjectArea: "" });
      qc.invalidateQueries({ queryKey: ["my-resources"] });
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">Resource Center</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Program Resources</h1>
        </div>
        {isStaff && (
          <Button size="sm" className="bg-[#1a3c5e] hover:bg-[#0d2540] shrink-0" onClick={() => setShowUpload(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Resource
          </Button>
        )}
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-[#1a3c5e]">Add Resource</h2>
              <button onClick={() => setShowUpload(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={submitUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
                    value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="document">Document</option>
                    <option value="video">Video</option>
                    <option value="link">Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    placeholder="e.g. Math, Science"
                    value={uploadForm.subjectArea} onChange={e => setUploadForm(f => ({ ...f, subjectArea: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL / Link</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  placeholder="https://..."
                  value={uploadForm.externalUrl} onChange={e => setUploadForm(f => ({ ...f, externalUrl: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[60px] resize-none"
                  value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
                <Button type="submit" disabled={uploading} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Resource
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
