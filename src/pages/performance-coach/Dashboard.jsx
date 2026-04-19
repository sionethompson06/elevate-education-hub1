import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { Users, Activity, AlertTriangle, Calendar, MessageCircle, Star, Pencil, Trash2, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function PerformanceCoachDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState("");

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["pc-assignments", user?.id],
    queryFn: () => apiGet("/gradebook/coach-assignments"),
    enabled: !!user,
  });

  const activeAthlete = selectedAthlete || assignments[0] || null;

  const { data: pointsData } = useQuery({
    queryKey: ["pc-points", activeAthlete?.student_id],
    queryFn: () => apiGet(`/rewards/points/${activeAthlete.student_id}`),
    enabled: !!activeAthlete?.student_id,
  });

  const { data: trainingLogs = [] } = useQuery({
    queryKey: ["pc-logs", activeAthlete?.student_id],
    queryFn: () => apiGet(`/training-logs/student/${activeAthlete.student_id}`).then(r => r.logs || []),
    enabled: !!activeAthlete?.student_id,
  });

  const { data: coachSummary } = useQuery({
    queryKey: ["pc-summary", user?.id],
    queryFn: () => apiGet('/training-logs/coach-summary'),
    enabled: !!user,
  });

  const { data: notesData } = useQuery({
    queryKey: ["pc-notes", activeAthlete?.student_id],
    queryFn: () => apiGet(`/coach-notes/student/${activeAthlete.student_id}`),
    enabled: !!activeAthlete?.student_id,
  });
  const notes = notesData?.notes || [];

  const saveNote = async () => {
    if (!noteText.trim() || !activeAthlete) return;
    setSavingNote(true);
    try {
      await apiPost("/coach-notes", {
        studentId: activeAthlete.student_id,
        content: noteText.trim(),
        visibility: "staff_only",
      });
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["pc-notes", activeAthlete.student_id] });
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
    }
  };

  const saveEditNote = async (id) => {
    if (!editNoteText.trim()) return;
    try {
      await apiPatch(`/coach-notes/${id}`, { content: editNoteText.trim() });
      setEditingNoteId(null);
      qc.invalidateQueries({ queryKey: ["pc-notes", activeAthlete.student_id] });
    } catch (err) {
      console.error("Failed to update note:", err);
    }
  };

  const deleteNote = async (id) => {
    try {
      await apiDelete(`/coach-notes/${id}`);
      qc.invalidateQueries({ queryKey: ["pc-notes", activeAthlete.student_id] });
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-2">
            Performance Coach
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Coach {user?.lastName || user?.last_name || "Dashboard"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link to="/performance-coach/schedule">
            <Button variant="outline" size="sm" className="gap-1"><Calendar className="w-4 h-4" /> Schedule</Button>
          </Link>
          <Link to="/performance-coach/messages">
            <Button variant="outline" size="sm" className="gap-1"><MessageCircle className="w-4 h-4" /> Messages</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Assigned Athletes", value: assignments.length, color: "text-blue-600", bg: "bg-blue-50", icon: Users },
          { label: "Training Logs", value: trainingLogs.length, color: "text-orange-600", bg: "bg-orange-50", icon: Activity },
          { label: "Total Points", value: pointsData?.points ?? "—", color: "text-purple-600", bg: "bg-purple-50", icon: Star },
          { label: "Needs Attention", value: coachSummary?.needsAttention ?? "—", color: "text-red-500", bg: "bg-red-50", icon: AlertTriangle },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <CardTitle className="text-xs font-medium text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4" /> Athlete Roster
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" /></div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No athletes assigned yet.</p>
            ) : (
              <div className="divide-y">
                {assignments.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAthlete(a)}
                    className={`w-full text-left px-4 py-3 transition-colors ${activeAthlete?.student_id === a.student_id ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50"}`}
                  >
                    <p className={`text-sm font-semibold ${activeAthlete?.student_id === a.student_id ? "text-white" : "text-slate-800"}`}>
                      {a.student_name || "Unknown"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {activeAthlete ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-700">{activeAthlete.student_name} — Performance Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-orange-700">{pointsData?.points ?? 0}</p>
                      <p className="text-xs text-orange-500">Total Points</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-blue-700">{trainingLogs.length}</p>
                      <p className="text-xs text-blue-500">Sessions Logged</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-700">Log Coach Note / Progress Update</CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Enter training notes, performance observations, or next steps..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[80px] resize-none"
                  />
                  <button
                    onClick={saveNote}
                    disabled={savingNote || !noteText.trim()}
                    className="mt-2 px-4 py-2 bg-[#1a3c5e] text-white text-sm rounded-lg hover:bg-[#0d2540] disabled:opacity-50 transition-colors"
                  >
                    {savingNote ? "Saving..." : "Save Note"}
                  </button>
                </CardContent>
              </Card>

              {notes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-700">Note History</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {notes.slice(0, 8).map(note => (
                        <div key={note.id} className="px-4 py-3">
                          {editingNoteId === note.id ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[60px] resize-none"
                                value={editNoteText}
                                onChange={e => setEditNoteText(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button onClick={() => saveEditNote(note.id)} className="flex items-center gap-1 text-xs text-[#1a3c5e] font-medium hover:underline">
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button onClick={() => setEditingNoteId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {note.createdAt ? format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
                                  {note.coachFirstName ? ` · ${note.coachFirstName} ${note.coachLastName || ""}` : ""}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content); }}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteNote(note.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {trainingLogs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-700">Recent Training Logs</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {trainingLogs.slice(0, 5).map(log => (
                        <div key={log.id} className="px-4 py-3 flex justify-between text-sm">
                          <div>
                            <p className="font-medium text-slate-800 capitalize">{log.type || "Training"}</p>
                            <p className="text-xs text-slate-400">
                              {log.date ? format(new Date(log.date), "MMM d, yyyy") : "—"}
                              {log.durationMinutes ? ` · ${log.durationMinutes} min` : ""}
                            </p>
                          </div>
                          {log.notes && (
                            <span className="text-xs text-slate-500 max-w-xs truncate ml-4">{log.notes}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Select an athlete to view their profile.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
