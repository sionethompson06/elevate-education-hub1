import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Calendar, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch } from "@/api/apiClient";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const RECURRENCE = ["Weekly", "Biweekly", "Monthly", "One-time"];
const SESSION_TYPES = ["Group", "1-on-1", "Workshop", "Virtual"];

function emptySession() {
  return { day: "Monday", startTime: "09:00", endTime: "10:00", location: "", type: "Group", recurrence: "Weekly" };
}

export default function CoachSchedulePanel({ coach }) {
  const qc = useQueryClient();
  const [editingSection, setEditingSection] = useState(null);
  const [draftSessions, setDraftSessions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["coach-schedule", coach.id],
    queryFn: () => apiGet(`/coaches/${coach.id}/schedule`),
  });

  const sections = data?.sections || [];

  const startEditing = (section) => {
    const sessions = section.schedule?.sessions || [];
    setDraftSessions(sessions.length ? sessions.map(s => ({ ...s })) : [emptySession()]);
    setEditingSection(section.id);
    setError("");
    setSuccessMsg("");
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setDraftSessions([]);
    setError("");
  };

  const addSession = () => setDraftSessions(s => [...s, emptySession()]);
  const removeSession = (i) => setDraftSessions(s => s.filter((_, idx) => idx !== i));
  const updateSession = (i, field, value) =>
    setDraftSessions(s => s.map((sess, idx) => idx === i ? { ...sess, [field]: value } : sess));

  const handleSave = async (sectionId) => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await apiPatch(`/coaches/${coach.id}/section-schedule`, {
        sectionId,
        schedule: { sessions: draftSessions },
      });
      qc.invalidateQueries({ queryKey: ["coach-schedule", coach.id] });
      setSuccessMsg("Schedule saved.");
      setEditingSection(null);
      setDraftSessions([]);
    } catch (err) {
      setError(err.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No sections assigned to this coach yet.</p>
        <p className="text-xs mt-1">Assign sections via Staff Assignments to manage schedules here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
      {successMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{successMsg}</p>}

      {sections.map(section => {
        const isEditing = editingSection === section.id;
        const sessions = section.schedule?.sessions || [];
        return (
          <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{section.name}</p>
                <p className="text-xs text-slate-400">
                  {section.programName || "—"}
                  {section.room ? ` · Room: ${section.room}` : ""}
                  {` · ${section.studentCount} student${section.studentCount !== 1 ? "s" : ""}`}
                </p>
              </div>
              {!isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#1a3c5e] text-[#1a3c5e] hover:bg-[#1a3c5e]/5 text-xs h-8"
                  onClick={() => startEditing(section)}
                >
                  Edit Schedule
                </Button>
              )}
            </div>

            {/* Students in section */}
            {section.students?.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-1.5">
                {section.students.map(s => (
                  <span key={s.studentId} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                    {s.firstName} {s.lastName}
                  </span>
                ))}
              </div>
            )}

            {/* Schedule sessions — view mode */}
            {!isEditing && (
              <div className="px-4 py-3">
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No sessions scheduled. Click Edit to add sessions.</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((sess, i) => (
                      <div key={i} className="flex flex-wrap gap-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">{sess.day}</span>
                        <span>{sess.startTime} – {sess.endTime}</span>
                        {sess.location && <span>· {sess.location}</span>}
                        <span className="text-slate-400">{sess.type} · {sess.recurrence}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Schedule sessions — edit mode */}
            {isEditing && (
              <div className="px-4 py-4 space-y-3">
                {draftSessions.map((sess, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white space-y-2 relative">
                    <button
                      onClick={() => removeSession(i)}
                      className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Day</label>
                        <select
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none"
                          value={sess.day}
                          onChange={e => updateSession(i, "day", e.target.value)}
                        >
                          {DAYS.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Start</label>
                        <input type="time" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none" value={sess.startTime} onChange={e => updateSession(i, "startTime", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">End</label>
                        <input type="time" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none" value={sess.endTime} onChange={e => updateSession(i, "endTime", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Location</label>
                        <input className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none" placeholder="Room A" value={sess.location} onChange={e => updateSession(i, "location", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Type</label>
                        <select className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none" value={sess.type} onChange={e => updateSession(i, "type", e.target.value)}>
                          {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Recurrence</label>
                        <select className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none" value={sess.recurrence} onChange={e => updateSession(i, "recurrence", e.target.value)}>
                          {RECURRENCE.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addSession} className="flex items-center gap-1.5 text-xs text-[#1a3c5e] hover:underline font-semibold">
                  <Plus className="w-3.5 h-3.5" /> Add Session
                </button>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving} className="flex-1 text-xs h-8">Cancel</Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs h-8 bg-[#1a3c5e] hover:bg-[#0d2540] text-white"
                    onClick={() => handleSave(section.id)}
                    disabled={saving}
                  >
                    {saving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Saving…</> : <><Save className="w-3 h-3 mr-1" />Save</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
