import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { Users, Plus, X, Pencil, Loader2, Trash2, ChevronRight, UserPlus, UserMinus, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const EMPTY_FORM = { programId: "", name: "", termId: "", capacity: "20", schedule: "", room: "", status: "active" };

function SectionModal({ initial, programs, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? {
    programId: String(initial.programId || ""),
    name: initial.name || "",
    termId: String(initial.termId || ""),
    capacity: String(initial.capacity || "20"),
    schedule: typeof initial.schedule === "string" ? initial.schedule : (initial.schedule?.text || ""),
    room: initial.room || "",
    status: initial.status || "active",
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    if (!form.programId || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        programId: parseInt(form.programId),
        name: form.name.trim(),
        termId: form.termId ? parseInt(form.termId) : null,
        capacity: form.capacity ? parseInt(form.capacity) : 20,
        schedule: form.schedule.trim() || null,
        room: form.room.trim() || null,
        status: form.status,
      };
      if (initial?.id) {
        await apiPatch(`/sections/${initial.id}`, payload);
        toast({ title: "Section updated" });
      } else {
        await apiPost("/sections", payload);
        toast({ title: "Section created" });
      }
      onSaved();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const activePrograms = programs.filter(p => p.status === "active");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#1a3c5e] text-lg">{initial?.id ? "Edit Section" : "Create Section"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Program *</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={form.programId} onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}>
              <option value="">Select program…</option>
              {activePrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Section Name *</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Group A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
              <input type="number" min="1"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Schedule</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} placeholder="e.g. Mon/Wed 9–11am" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Room</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 204" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving || !form.programId || !form.name.trim()} className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            {initial?.id ? "Save Changes" : "Create Section"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RosterTab({ section, allStudents, enrollments, onRefresh }) {
  const [addingId, setAddingId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  const { data: detailData, refetch } = useQuery({
    queryKey: ["section-detail", section.id],
    queryFn: () => apiGet(`/sections/${section.id}`),
  });
  const rosterStudents = detailData?.students || [];
  const rosterIds = new Set(rosterStudents.map(s => s.studentId));

  // Students enrolled in this section's program but not yet in the roster
  const enrolledInProgram = enrollments
    .filter(e => e.programId === section.programId && ["active", "active_override"].includes(e.status))
    .map(e => e.studentId);
  const available = allStudents.filter(s => enrolledInProgram.includes(s.id) && !rosterIds.has(s.id));

  const addStudent = async () => {
    if (!addingId) return;
    setAdding(true);
    try {
      await apiPost(`/sections/${section.id}/students`, { studentId: parseInt(addingId) });
      setAddingId("");
      refetch();
      onRefresh();
      toast({ title: "Student added to section" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeStudent = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await apiDelete(`/sections/${section.id}/students/${removeTarget.studentId}`);
      setRemoveTarget(null);
      refetch();
      onRefresh();
      toast({ title: "Student removed from section" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          value={addingId} onChange={e => setAddingId(e.target.value)}>
          <option value="">Add student…</option>
          {available.map(s => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
          ))}
        </select>
        <Button size="sm" onClick={addStudent} disabled={!addingId || adding} className="bg-[#1a3c5e] hover:bg-[#0d2540] shrink-0">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        </Button>
      </div>

      {available.length === 0 && rosterStudents.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">No students enrolled in this program yet.</p>
      )}

      <div className="divide-y border rounded-lg overflow-hidden">
        {rosterStudents.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No students in this section yet.</p>
        ) : rosterStudents.map(s => (
          <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-800">{s.firstName} {s.lastName}</p>
              {s.grade && <p className="text-xs text-slate-400">Grade {s.grade}</p>}
            </div>
            <button onClick={() => setRemoveTarget(s)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
              <UserMinus className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.firstName} {removeTarget?.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>They will be removed from this section's roster. Their enrollment in the program is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={removeStudent} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CoachesTab({ section, coaches }) {
  const [assigningCoachId, setAssigningCoachId] = useState("");
  const [coachType, setCoachType] = useState("academic_coach");
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  const { data: detailData, refetch: refetchDetail } = useQuery({
    queryKey: ["section-detail", section.id],
    queryFn: () => apiGet(`/sections/${section.id}`),
  });
  const rosterStudents = detailData?.students || [];

  const { data: assignmentsData, refetch } = useQuery({
    queryKey: ["coach-assignments-section", section.id],
    queryFn: () => apiGet(`/coach-assignments`),
    enabled: rosterStudents.length > 0,
  });
  const allAssignments = assignmentsData?.assignments || [];

  // Find assignments for students in this section
  const rosterStudentIds = new Set(rosterStudents.map(s => s.studentId));
  const sectionAssignments = allAssignments.filter(a => rosterStudentIds.has(a.studentId) && a.isActive);

  // Group by coachUserId
  const coachMap = {};
  for (const a of sectionAssignments) {
    if (!coachMap[a.coachUserId]) coachMap[a.coachUserId] = { coachUserId: a.coachUserId, coachType: a.coachType, students: [] };
    coachMap[a.coachUserId].students.push(a.studentId);
  }
  const assignedCoaches = Object.values(coachMap);

  const assignCoach = async () => {
    if (!assigningCoachId || rosterStudents.length === 0) return;
    setAssigning(true);
    try {
      for (const s of rosterStudents) {
        await apiPost("/coach-assignments", {
          coachUserId: parseInt(assigningCoachId),
          studentId: s.studentId,
          coachType,
        });
      }
      setAssigningCoachId("");
      refetch();
      toast({ title: `Coach assigned to ${rosterStudents.length} student(s)` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const coachName = (id) => {
    const c = coaches.find(u => u.id === id);
    return c ? `${c.firstName} ${c.lastName}` : `Coach #${id}`;
  };

  return (
    <div className="space-y-4">
      {rosterStudents.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">Add students to the roster first before assigning coaches.</p>
      )}

      {rosterStudents.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={assigningCoachId} onChange={e => setAssigningCoachId(e.target.value)}>
              <option value="">Select coach…</option>
              {coaches.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.role?.replace("_", " ")})</option>
              ))}
            </select>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={coachType} onChange={e => setCoachType(e.target.value)}>
              <option value="academic_coach">Academic</option>
              <option value="performance_coach">Performance</option>
            </select>
          </div>
          <Button size="sm" onClick={assignCoach} disabled={!assigningCoachId || assigning} className="w-full bg-[#1a3c5e] hover:bg-[#0d2540]">
            {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
            Assign to All Students in Section
          </Button>
        </div>
      )}

      <div className="divide-y border rounded-lg overflow-hidden">
        {assignedCoaches.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No coaches assigned to students in this section.</p>
        ) : assignedCoaches.map(a => (
          <div key={a.coachUserId} className="flex items-center justify-between px-3 py-2.5 bg-white">
            <div>
              <p className="text-sm font-medium text-slate-800">{coachName(a.coachUserId)}</p>
              <p className="text-xs text-slate-400 capitalize">{a.coachType?.replace("_", " ")} · {a.students.length} student(s)</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const WEEKDAY_OPTIONS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

function SessionsTab({ section }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    weekdays: ["mon", "wed"],
    startTime: "16:00",
    endTime: "17:00",
    location: section.room || "",
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["section-sessions", section.id],
    queryFn: () => apiGet(`/sections/${section.id}/sessions`),
  });
  const sessions = data?.sessions || [];

  const toggleWeekday = (day) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));
  };

  const generateSessions = async () => {
    if (!form.startDate || !form.endDate || form.weekdays.length === 0) {
      toast({ title: "Missing required fields", description: "Set date range and at least one weekday.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost(`/sections/${section.id}/sessions/generate`, form);
      qc.invalidateQueries({ queryKey: ["section-sessions", section.id] });
      toast({
        title: "Sessions generated",
        description: `${res.createdCount || 0} created, ${res.skippedCount || 0} skipped as duplicates.`,
      });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSession = async (sessionId, payload) => {
    await apiPatch(`/sections/${section.id}/sessions/${sessionId}`, payload);
    qc.invalidateQueries({ queryKey: ["section-sessions", section.id] });
  };

  const deleteSession = async (sessionId) => {
    setDeletingId(sessionId);
    try {
      await apiDelete(`/sections/${section.id}/sessions/${sessionId}`);
      qc.invalidateQueries({ queryKey: ["section-sessions", section.id] });
      toast({ title: "Session deleted" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleCanceled = async (session) => {
    try {
      const isCanceled = session.status === "canceled";
      await updateSession(session.id, {
        status: isCanceled ? "scheduled" : "canceled",
        canceledReason: isCanceled ? null : "admin_canceled",
      });
      toast({ title: isCanceled ? "Session restored" : "Session canceled" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-3 space-y-3 bg-slate-50/70">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Generate recurring sessions</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start date</label>
            <input type="date" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">End date</label>
            <input type="date" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start time</label>
            <input type="time" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" value={form.startTime}
              onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">End time</label>
            <input type="time" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" value={form.endTime}
              onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Location override</label>
          <input className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" placeholder="Use section room if blank" value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />
        </div>
        <div>
          <p className="block text-xs text-slate-500 mb-1">Weekdays</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((day) => (
              <button
                type="button"
                key={day.value}
                onClick={() => toggleWeekday(day.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${form.weekdays.includes(day.value)
                  ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={generateSessions} disabled={saving} className="w-full bg-[#1a3c5e] hover:bg-[#0d2540]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CalendarDays className="w-4 h-4 mr-1.5" />}
          Generate Sessions
        </Button>
      </div>

      <div className="divide-y border rounded-lg overflow-hidden">
        {isLoading ? (
          <p className="text-xs text-slate-400 text-center py-6">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No sessions scheduled yet.</p>
        ) : sessions.map((session) => {
          const dateLabel = session.sessionDate ? new Date(`${session.sessionDate}T00:00:00`).toLocaleDateString() : "Unknown date";
          const timeLabel = session.startAt
            ? new Date(session.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "TBD";
          const endLabel = session.endAt
            ? new Date(session.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : null;
          return (
            <div key={session.id} className="flex items-center justify-between px-3 py-2.5 bg-white">
              <div>
                <p className="text-sm font-medium text-slate-800">{dateLabel} · {timeLabel}{endLabel ? ` - ${endLabel}` : ""}</p>
                <p className="text-xs text-slate-400">{session.location || section.room || "Location TBD"}</p>
                {session.canceledReason && <p className="text-xs text-amber-600 mt-0.5">Reason: {session.canceledReason}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${session.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                  {session.status}
                </span>
                <button onClick={() => setEditing(session)} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Edit
                </button>
                <button onClick={() => toggleCanceled(session)} className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50">
                  {session.status === "canceled" ? "Restore" : "Cancel"}
                </button>
                <button
                  onClick={() => deleteSession(session.id)}
                  disabled={deletingId === session.id}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingId === session.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SessionEditModal
        section={section}
        session={editing}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          await updateSession(editing.id, payload);
          setEditing(null);
          toast({ title: "Session updated" });
        }}
      />
    </div>
  );
}

function SessionEditModal({ section, session, onClose, onSave }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) {
      setForm(null);
      return;
    }
    const start = session.startAt ? new Date(session.startAt) : null;
    const end = session.endAt ? new Date(session.endAt) : null;
    setForm({
      sessionDate: session.sessionDate || "",
      startTime: start ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}` : "",
      endTime: end ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}` : "",
      location: session.location || section.room || "",
      status: session.status || "scheduled",
      canceledReason: session.canceledReason || "",
    });
  }, [session, section.room]);

  if (!session || !form) return null;

  const combineDateTime = (date, time) => (date && time ? `${date}T${time}:00` : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1a3c5e]">Edit Session</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date</label>
            <input type="date" value={form.sessionDate} onChange={(e) => setForm((prev) => ({ ...prev, sessionDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm">
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start time</label>
            <input type="time" value={form.startTime} onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">End time</label>
            <input type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Location</label>
          <input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
        </div>
        {form.status === "canceled" && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cancel reason</label>
            <input value={form.canceledReason} onChange={(e) => setForm((prev) => ({ ...prev, canceledReason: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm" />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]"
            disabled={saving || !form.sessionDate}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  sessionDate: form.sessionDate,
                  startAt: combineDateTime(form.sessionDate, form.startTime),
                  endAt: combineDateTime(form.sessionDate, form.endTime),
                  location: form.location || null,
                  status: form.status,
                  canceledReason: form.status === "canceled" ? (form.canceledReason || "admin_canceled") : null,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduleBoard({ programFilter }) {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 14);
    return dt.toISOString().slice(0, 10);
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-schedule-overview", from, to, programFilter],
    queryFn: () => apiGet(`/sections/schedule/overview?from=${from}&to=${to}${programFilter ? `&programId=${programFilter}` : ""}`),
  });
  const sessions = data?.sessions || [];

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-slate-400 mb-1">Showing {sessions.length} scheduled session(s).</p>
        </div>

        <div className="divide-y border rounded-lg overflow-hidden">
          {isLoading ? (
            <p className="text-xs text-slate-400 text-center py-6">Loading schedule…</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No sessions in this range.</p>
          ) : sessions.map((s) => (
            <div key={s.sessionId} className="px-3 py-2.5 bg-white flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {new Date(`${s.sessionDate}T00:00:00`).toLocaleDateString()} · {s.sectionName}
                </p>
                <p className="text-xs text-slate-500">{s.programName || "Program"} · {s.location || s.room || "Location TBD"}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionDetail({ section, allStudents, enrollments, coaches, onEdit, onClose }) {
  const [tab, setTab] = useState("roster");
  const qc = useQueryClient();

  const onRefresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-sections"] });
  };

  const scheduleText = typeof section.schedule === "string"
    ? section.schedule
    : section.schedule?.text || "";

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-[#1a3c5e] text-lg">{section.name}</h3>
            <p className="text-xs text-slate-500">{section.programName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(section)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b bg-slate-50 text-xs text-slate-500 flex gap-4 flex-wrap">
          <span>Capacity: {section.capacity}</span>
          {scheduleText && <span>Schedule: {scheduleText}</span>}
          {section.room && <span>Room: {section.room}</span>}
          <span className={`font-medium capitalize ${section.status === "active" ? "text-green-600" : "text-slate-400"}`}>{section.status}</span>
        </div>

        <div className="flex border-b">
          {["roster", "coaches", "sessions"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? "text-[#1a3c5e] border-b-2 border-[#1a3c5e]" : "text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "roster" ? (
            <RosterTab section={section} allStudents={allStudents} enrollments={enrollments} onRefresh={onRefresh} />
          ) : tab === "coaches" ? (
            <CoachesTab section={section} coaches={coaches} />
          ) : (
            <SessionsTab section={section} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSections() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [programFilter, setProgramFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState("sections");

  const { data: programsData } = useQuery({
    queryKey: ["admin-programs-page"],
    queryFn: () => apiGet("/programs"),
  });
  const programs = programsData?.programs || [];

  const { data: sectionsData, isLoading } = useQuery({
    queryKey: ["admin-sections", programFilter],
    queryFn: () => apiGet(`/sections${programFilter ? `?programId=${programFilter}` : ""}`),
  });
  const sections = sectionsData?.sections || [];

  const { data: studentsData } = useQuery({
    queryKey: ["admin-students-list"],
    queryFn: () => apiGet("/students"),
  });
  const allStudents = studentsData?.students || [];

  const { data: enrollmentsData } = useQuery({
    queryKey: ["admin-enrollments-for-programs"],
    queryFn: () => apiGet("/enrollments"),
  });
  const allEnrollments = enrollmentsData?.enrollments || [];

  const { data: usersData } = useQuery({
    queryKey: ["admin-users-coaches"],
    queryFn: () => apiGet("/users"),
  });
  const coaches = (usersData?.users || []).filter(u => ["academic_coach", "performance_coach"].includes(u.role));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-sections"] });
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/sections/${deleteTarget.id}`);
      invalidate();
      setDeleteTarget(null);
      if (selectedSection?.id === deleteTarget.id) setSelectedSection(null);
      toast({ title: "Section deleted" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (s) => {
    setEditing(s);
    setSelectedSection(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
          <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3"><Users className="w-8 h-8" /> Sections</h1>
          <p className="text-slate-500 mt-1">Create sections, manage rosters, and assign coaches.</p>
        </div>
        <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Section
        </Button>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-56"
            value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
            <option value="">All Programs</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("sections")}
              className={`px-3 py-2 text-xs font-medium ${view === "sections" ? "bg-[#1a3c5e] text-white" : "bg-white text-slate-600"}`}
            >
              Sections
            </button>
            <button
              onClick={() => setView("schedule")}
              className={`px-3 py-2 text-xs font-medium ${view === "schedule" ? "bg-[#1a3c5e] text-white" : "bg-white text-slate-600"}`}
            >
              Schedule Board
            </button>
          </div>
        </div>
      </div>

      {view === "schedule" ? (
        <ScheduleBoard programFilter={programFilter} />
      ) : (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
            ) : sections.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-3">No sections yet.</p>
                <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" /> Create First Section</Button>
              </div>
            ) : (
              <div className="divide-y">
                {sections.map(s => {
                  const rosterCount = allEnrollments.filter(e => e.sectionId === s.id).length;
                  const scheduleText = typeof s.schedule === "string" ? s.schedule : s.schedule?.text || "";
                  return (
                    <div key={s.id}
                      className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 gap-4 cursor-pointer"
                      onClick={() => setSelectedSection(s)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-slate-800">{s.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{s.programName}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                          <span>{rosterCount} / {s.capacity} students</span>
                          {scheduleText && <span>{scheduleText}</span>}
                          {s.room && <span>{s.room}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(showModal || editing) && (
        <SectionModal
          initial={editing}
          programs={programs}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={invalidate}
        />
      )}

      {selectedSection && (
        <SectionDetail
          section={selectedSection}
          allStudents={allStudents}
          enrollments={allEnrollments}
          coaches={coaches}
          onEdit={openEdit}
          onClose={() => setSelectedSection(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the section and its roster. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
