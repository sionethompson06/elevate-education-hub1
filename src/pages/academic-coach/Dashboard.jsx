import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { Plus, Users, AlertTriangle, BookOpen, MessageSquare, Pencil, Trash2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import KPIBar from "@/components/gradebook/KPIBar";
import LessonRow from "@/components/gradebook/LessonRow";
import LessonDetailPanel from "@/components/gradebook/LessonDetailPanel";
import CreateLessonModal from "@/components/gradebook/CreateLessonModal";

const SUBJECTS = ["all", "Math", "English", "Science", "History", "Reading", "Writing", "PE", "General"];

export default function AcademicCoachDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState("");

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["coach-queue", user?.id],
    queryFn: () => apiGet("/gradebook/queue"),
    enabled: !!user,
  });

  const { data: lessonsData, isLoading: lessonsLoading, refetch } = useQuery({
    queryKey: ["coach-lessons", user?.id, selectedStudent, subject],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedStudent) params.set("student_id", selectedStudent);
      if (subject !== "all") params.set("subject", subject);
      const qs = params.toString();
      return apiGet(`/gradebook/lessons${qs ? "?" + qs : ""}`);
    },
    enabled: !!user,
  });

  const queue = queueData?.queue || [];
  const lessons = lessonsData?.lessons || [];
  const kpis = lessonsData?.kpis;

  const { data: notesData } = useQuery({
    queryKey: ["ac-notes", selectedStudent],
    queryFn: () => apiGet(`/coach-notes/student/${selectedStudent}`),
    enabled: !!selectedStudent,
  });
  const notes = notesData?.notes || [];

  const saveNote = async () => {
    if (!noteText.trim() || !selectedStudent) return;
    setSavingNote(true);
    try {
      await apiPost("/coach-notes", {
        studentId: selectedStudent,
        content: noteText.trim(),
        visibility: "staff_only",
      });
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["ac-notes", selectedStudent] });
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
      qc.invalidateQueries({ queryKey: ["ac-notes", selectedStudent] });
    } catch (err) {
      console.error("Failed to update note:", err);
    }
  };

  const deleteNote = async (id) => {
    try {
      await apiDelete(`/coach-notes/${id}`);
      qc.invalidateQueries({ queryKey: ["ac-notes", selectedStudent] });
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const handleUpdated = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["coach-queue"] });
    setSelectedLesson(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold mb-2">
            Academic Coach
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">
            Coach {user?.lastName || user?.last_name || "Dashboard"}
          </h1>
        </div>
        <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Assign Lesson
        </Button>
      </div>

      {kpis && <KPIBar kpis={kpis} />}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4" /> My Students
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {queueLoading ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
            ) : queue.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No students assigned.</p>
            ) : (
              <div className="divide-y">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${!selectedStudent ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50 text-slate-700"}`}
                >
                  All Students ({queue.length})
                </button>
                {queue.map(s => (
                  <button
                    key={s.student_id}
                    onClick={() => setSelectedStudent(s.student_id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${selectedStudent === s.student_id ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${selectedStudent === s.student_id ? "text-white" : "text-slate-800"}`}>
                        {s.student_name}
                      </span>
                      {s.kpis?.intervention && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    </div>
                    <div className={`text-xs mt-0.5 ${selectedStudent === s.student_id ? "text-slate-300" : "text-slate-400"}`}>
                      {s.kpis?.overdue_count > 0 && `${s.kpis.overdue_count} overdue · `}
                      {s.kpis?.incomplete_count} incomplete
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base text-slate-700 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Lessons
              </CardTitle>
              <div className="flex gap-1 flex-wrap">
                {SUBJECTS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${subject === s ? "bg-[#1a3c5e] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lessonsLoading ? (
              <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
            ) : lessons.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No lessons found.</p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                {lessons.map(l => (
                  <LessonRow key={l.id} lesson={l} onClick={() => setSelectedLesson(l)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedStudent && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Coach Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Enter notes, observations, or next steps for this student..."
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
                <div className="divide-y max-h-64 overflow-y-auto">
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
        </div>
      )}

      {showCreate && (
        <CreateLessonModal
          assignedStudents={queue}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); handleUpdated(); }}
        />
      )}
      {selectedLesson && (
        <LessonDetailPanel
          lesson={selectedLesson}
          readOnly={false}
          onClose={() => setSelectedLesson(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
