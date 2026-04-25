import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { Calendar, Activity, Plus, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const TYPE_LABELS = { strength: "Strength", conditioning: "Conditioning", skill: "Skill", speed: "Speed", recovery: "Recovery", general: "General" };

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [logForm, setLogForm] = useState({ studentId: "", date: "", type: "general", durationMinutes: 60, notes: "" });
  const [saving, setSaving] = useState(false);

  const isCoach = ["academic_coach", "performance_coach", "admin"].includes(user?.role);

  const { data: student } = useQuery({
    queryKey: ["my-student", user?.id],
    queryFn: () => apiGet(`/students/by-user/${user.id}`).then(r => r.student),
    enabled: !!user?.id && !isCoach,
  });

  const { data: myStudents = [] } = useQuery({
    queryKey: ["my-students-for-logs", user?.id],
    queryFn: () => apiGet("/training-logs/my-students").then(r => r.students || []),
    enabled: !!user && isCoach,
  });

  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const activeStudentId = isCoach ? (selectedStudentId || myStudents[0]?.id) : student?.id;

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["attendance-logs", activeStudentId],
    queryFn: () => apiGet(`/training-logs/student/${activeStudentId}`).then(r => r.logs || []),
    enabled: !!activeStudentId,
  });

  const createLog = async () => {
    if (!logForm.date || !logForm.studentId) return;
    setSaving(true);
    try {
      await apiPost("/training-logs", {
        studentId: parseInt(logForm.studentId),
        date: logForm.date,
        type: logForm.type,
        durationMinutes: logForm.durationMinutes ? parseInt(logForm.durationMinutes) : null,
        notes: logForm.notes || null,
      });
      setShowCreate(false);
      setLogForm({ studentId: "", date: "", type: "general", durationMinutes: 60, notes: "" });
      refetch();
    } catch (err) {
      console.error("Failed to create log:", err);
    } finally {
      setSaving(false);
    }
  };

  const total = logs.length;
  const thisMonth = logs.filter(l => {
    if (!l.date) return false;
    const d = new Date(l.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">Training</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Training Sessions</h1>
        </div>
        {isCoach && (
          <Button onClick={() => setShowCreate(true)} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
            <Plus className="w-4 h-4 mr-2" /> Log Session
          </Button>
        )}
      </div>

      {isCoach && myStudents.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {myStudents.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStudentId(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${activeStudentId === s.id ? "border-[#1a3c5e] bg-[#1a3c5e] text-white" : "border-slate-200 text-slate-700 hover:border-[#1a3c5e]"}`}
            >
              {s.firstName} {s.lastName}
            </button>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{total}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Sessions</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{thisMonth}</p>
            <p className="text-xs text-blue-500 mt-0.5">This Month</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">
              {logs.reduce((s, l) => s + (l.durationMinutes || 0), 0)}
            </p>
            <p className="text-xs text-green-500 mt-0.5">Total Minutes</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No training sessions logged.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map(log => (
                <div key={log.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm capitalize">{TYPE_LABELS[log.type] || log.type || "General"} Session</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                      <span>{log.date ? format(new Date(log.date), "MMM d, yyyy") : "—"}</span>
                      {log.durationMinutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.durationMinutes} min</span>}
                      {log.notes && <span className="truncate max-w-xs">{log.notes}</span>}
                    </div>
                  </div>
                  <Activity className="w-4 h-4 text-slate-300 shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-[#1a3c5e] text-lg">Log Training Session</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Student *</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={logForm.studentId}
                onChange={e => setLogForm(f => ({ ...f, studentId: e.target.value }))}
              >
                <option value="">Select student...</option>
                {myStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={logForm.date}
                  onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={logForm.type}
                  onChange={e => setLogForm(f => ({ ...f, type: e.target.value }))}
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration (min)</label>
              <input
                type="number" min="5"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={logForm.durationMinutes}
                onChange={e => setLogForm(f => ({ ...f, durationMinutes: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none h-20"
                value={logForm.notes}
                onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Session notes..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <Button onClick={createLog} disabled={saving || !logForm.date || !logForm.studentId} className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
