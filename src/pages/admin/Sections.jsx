import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { Users, Plus, X, Pencil, Loader2, Trash2, ChevronRight, UserPlus, UserMinus, Eye, EyeOff, CalendarDays, List, Clock, MapPin, Ban, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const SESSION_STATUS_CLS = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  canceled:  "bg-red-100 text-red-600",
};

const EMPTY_FORM = { programId: "", name: "", subject: "", gradeLevel: "", description: "", termId: "", capacity: "20", schedule: "", room: "", status: "active", coachUserId: "" };

function SectionModal({ initial, programs, coaches, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? {
    programId: String(initial.programId || ""),
    name: initial.name || "",
    subject: initial.subject || "",
    gradeLevel: initial.gradeLevel || "",
    description: initial.description || "",
    termId: String(initial.termId || ""),
    capacity: String(initial.capacity || "20"),
    schedule: typeof initial.schedule === "string" ? initial.schedule : (initial.schedule?.text || ""),
    room: initial.room || "",
    status: initial.status || "active",
    coachUserId: String(initial.coachUserId || ""),
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
        subject: form.subject.trim() || null,
        gradeLevel: form.gradeLevel.trim() || null,
        description: form.description.trim() || null,
        termId: form.termId ? parseInt(form.termId) : null,
        capacity: form.capacity ? parseInt(form.capacity) : 20,
        schedule: form.schedule.trim() || null,
        room: form.room.trim() || null,
        status: form.status,
        coachUserId: form.coachUserId ? parseInt(form.coachUserId) : null,
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Coach</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              value={form.coachUserId} onChange={e => setForm(f => ({ ...f, coachUserId: e.target.value }))}>
              <option value="">— None —</option>
              {coaches.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.role?.replace(/_/g, " ")})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Math" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grade Level</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.gradeLevel} onChange={e => setForm(f => ({ ...f, gradeLevel: e.target.value }))} placeholder="e.g. 9th–10th" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional class description…" />
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

// ── Sessions Tab ──────────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getRecurringDates(fromDate, toDate, days) {
  if (!fromDate || !toDate || days.length === 0) return [];
  const result = [];
  const daySet = new Set(days);
  const end = new Date(toDate + "T00:00:00");
  const cur = new Date(fromDate + "T00:00:00");
  while (cur <= end) {
    if (daySet.has(cur.getDay())) result.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

const BLANK_FORM = { sessionDate: "", startAt: "", endAt: "", locationSnapshot: "", recurring: false, recurDays: [], recurFrom: "", recurTo: "" };

function SessionsTab({ section }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editTarget, setEditTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["section-sessions", section.id],
    queryFn: () => apiGet(`/sections/${section.id}/sessions`),
  });
  const sessions = data?.sessions || [];

  const invalidate = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["schedule-board"] });
  };

  const previewDates = form.recurring ? getRecurringDates(form.recurFrom, form.recurTo, form.recurDays) : [];

  const createSession = async () => {
    setCreating(true);
    try {
      if (form.recurring) {
        if (previewDates.length === 0) return;
        for (const date of previewDates) {
          await apiPost(`/sections/${section.id}/sessions`, {
            sessionDate: date,
            startAt: form.startAt || null,
            endAt: form.endAt || null,
            locationSnapshot: form.locationSnapshot.trim() || null,
          });
        }
        toast({ title: `${previewDates.length} sessions created` });
      } else {
        if (!form.sessionDate) return;
        await apiPost(`/sections/${section.id}/sessions`, {
          sessionDate: form.sessionDate,
          startAt: form.startAt || null,
          endAt: form.endAt || null,
          locationSnapshot: form.locationSnapshot.trim() || null,
        });
        toast({ title: "Session created" });
      }
      setForm(BLANK_FORM);
      setShowCreate(false);
      invalidate();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      await apiPatch(`/sections/sessions/${editTarget.id}`, {
        sessionDate: editTarget.sessionDate,
        startAt: editTarget.startAt || null,
        endAt: editTarget.endAt || null,
        locationSnapshot: editTarget.locationSnapshot?.trim() || null,
      });
      setEditTarget(null);
      invalidate();
      toast({ title: "Session updated" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const markComplete = async (s) => {
    try {
      await apiPatch(`/sections/sessions/${s.id}`, { status: "completed" });
      invalidate();
      toast({ title: "Marked complete" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const restoreSession = async (s) => {
    try {
      await apiPatch(`/sections/sessions/${s.id}`, { status: "scheduled", canceledReason: null });
      invalidate();
      toast({ title: "Session restored" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCanceling(true);
    try {
      await apiPatch(`/sections/sessions/${cancelTarget.id}`, {
        status: "canceled",
        canceledReason: cancelReason.trim() || null,
      });
      setCancelTarget(null);
      setCancelReason("");
      invalidate();
      toast({ title: "Session canceled" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCanceling(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/sections/sessions/${deleteTarget.id}`);
      setDeleteTarget(null);
      invalidate();
      toast({ title: "Session deleted" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleRecurDay = (d) => sf("recurDays", form.recurDays.includes(d) ? form.recurDays.filter(x => x !== d) : [...form.recurDays, d]);
  const ef = (k, v) => setEditTarget(p => ({ ...p, [k]: v }));

  const canSave = form.recurring
    ? previewDates.length > 0
    : !!form.sessionDate;

  return (
    <div className="space-y-4">
      {/* Add Session button / create form */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm font-medium text-slate-400 hover:border-[#1a3c5e]/40 hover:text-[#1a3c5e] transition-colors">
          <Plus className="w-4 h-4" /> Add Session
        </button>
      ) : (
        <div className="border border-[#1a3c5e]/20 rounded-xl p-4 space-y-3 bg-slate-50">
          {/* Header + recurring toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1a3c5e]">New Session</p>
            <button
              onClick={() => sf("recurring", !form.recurring)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${form.recurring ? "bg-[#1a3c5e] text-white border-[#1a3c5e]" : "bg-white text-slate-500 border-slate-200 hover:border-[#1a3c5e]/50"}`}>
              Recurring
            </button>
          </div>

          {/* Single date OR recurring range */}
          {!form.recurring ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={form.sessionDate} onChange={e => sf("sessionDate", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Day-of-week chips */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Repeat on</label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((label, idx) => (
                    <button key={idx} type="button"
                      onClick={() => toggleRecurDay(idx)}
                      className={`w-9 h-9 rounded-full text-xs font-bold border transition-colors ${form.recurDays.includes(idx) ? "bg-[#1a3c5e] text-white border-[#1a3c5e]" : "bg-white text-slate-500 border-slate-200 hover:border-[#1a3c5e]/40"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                  <input type="date" value={form.recurFrom} onChange={e => sf("recurFrom", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                  <input type="date" value={form.recurTo} onChange={e => sf("recurTo", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
                </div>
              </div>
              {/* Preview count */}
              {previewDates.length > 0 && (
                <p className="text-xs text-[#1a3c5e] font-medium bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  Creates <span className="font-bold">{previewDates.length}</span> session{previewDates.length !== 1 ? "s" : ""} —{" "}
                  {previewDates.slice(0, 3).map(d => fmtDate(d)).join(", ")}{previewDates.length > 3 ? ` … ${fmtDate(previewDates[previewDates.length - 1])}` : ""}
                </p>
              )}
              {form.recurDays.length > 0 && form.recurFrom && form.recurTo && previewDates.length === 0 && (
                <p className="text-xs text-amber-600">No matching dates in this range.</p>
              )}
            </div>
          )}

          {/* Time + Location (shared for both modes) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
              <input type="time" value={form.startAt} onChange={e => sf("startAt", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Time</label>
              <input type="time" value={form.endAt} onChange={e => sf("endAt", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
            <input value={form.locationSnapshot} onChange={e => sf("locationSnapshot", e.target.value)}
              placeholder={section.room || "e.g. Room 204"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setForm(BLANK_FORM); setShowCreate(false); }}>Cancel</Button>
            <Button size="sm" disabled={!canSave || creating} onClick={createSession}
              className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {form.recurring && previewDates.length > 1 ? `Create ${previewDates.length} Sessions` : "Save Session"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && !showCreate && (
        <div className="text-center py-8">
          <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No sessions yet. Add the first one above.</p>
        </div>
      )}

      {/* Session rows */}
      <div className="space-y-2">
        {sessions.map(s => (
          editTarget?.id === s.id ? (
            /* ── Inline edit form ── */
            <div key={s.id} className="border border-[#1a3c5e]/30 rounded-xl p-3 space-y-2 bg-blue-50/40">
              <p className="text-xs font-semibold text-[#1a3c5e]">Edit Session</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={editTarget.sessionDate} onChange={e => ef("sessionDate", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
                  <input type="time" value={editTarget.startAt || ""} onChange={e => ef("startAt", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Time</label>
                  <input type="time" value={editTarget.endAt || ""} onChange={e => ef("endAt", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                <input value={editTarget.locationSnapshot || ""} onChange={e => ef("locationSnapshot", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button size="sm" className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={saveEdit}>Save</Button>
              </div>
            </div>
          ) : (
            /* ── Session row ── */
            <div key={s.id} className={`rounded-xl border px-3 py-3 ${
              s.status === "canceled"  ? "bg-red-50 border-red-100" :
              s.status === "completed" ? "bg-green-50 border-green-100" :
              "bg-white border-slate-200"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{fmtDate(s.sessionDate)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${SESSION_STATUS_CLS[s.status] || "bg-slate-100 text-slate-500"}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                    {(s.startAt || s.endAt) && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtTime(s.startAt)}{s.endAt ? ` – ${fmtTime(s.endAt)}` : ""}
                      </span>
                    )}
                    {s.locationSnapshot && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.locationSnapshot}</span>
                    )}
                  </div>
                  {s.canceledReason && <p className="text-xs text-red-600 mt-1">Reason: {s.canceledReason}</p>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Edit — always available */}
                  <button onClick={() => setEditTarget({ ...s })} title="Edit"
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {s.status === "scheduled" && (<>
                    <button onClick={() => markComplete(s)} title="Mark complete"
                      className="p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setCancelTarget(s); setCancelReason(""); }} title="Cancel session"
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </>)}
                  {s.status === "canceled" && (
                    <button onClick={() => restoreSession(s)}
                      className="px-2 py-1 rounded text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                      Restore
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(s)} title="Delete"
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel session on {fmtDate(cancelTarget?.sessionDate)}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <label className="block text-sm font-medium text-slate-700 mt-3 mb-1">Reason (optional)</label>
                <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Coach unavailable"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmCancel} disabled={canceling}>
              {canceling ? "Canceling…" : "Cancel Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session on {fmtDate(deleteTarget?.sessionDate)}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the session. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
          {["roster", "sessions", "coaches"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? "text-[#1a3c5e] border-b-2 border-[#1a3c5e]" : "text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "roster" ? (
            <RosterTab section={section} allStudents={allStudents} enrollments={enrollments} onRefresh={onRefresh} />
          ) : tab === "sessions" ? (
            <SessionsTab section={section} />
          ) : (
            <CoachesTab section={section} coaches={coaches} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Schedule Board ────────────────────────────────────────────────────────────

function ScheduleBoard() {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeksOut = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(twoWeeksOut);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-board", from, to],
    queryFn: () => apiGet(`/sections/sessions-board?from=${from}&to=${to}`),
  });
  const allSessions = data?.sessions || [];

  const sessions = useMemo(() =>
    statusFilter === "all" ? allSessions : allSessions.filter(s => s.status === statusFilter),
    [allSessions, statusFilter]
  );

  const grouped = useMemo(() => {
    const map = {};
    for (const s of sessions) {
      if (!map[s.sessionDate]) map[s.sessionDate] = [];
      map[s.sessionDate].push(s);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none ml-auto">
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-16 text-center">
          <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No sessions in this date range.</p>
          <p className="text-xs text-slate-400 mt-1">Open a section and add sessions using the Sessions tab.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, daySessions]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-sm font-bold text-[#1a3c5e]">{fmtDate(date)}</p>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">{daySessions.length} session{daySessions.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {daySessions.map(s => {
                  const coach = s.coachFirstName ? `${s.coachFirstName} ${s.coachLastName}` : null;
                  const location = s.locationSnapshot || s.room || null;
                  return (
                    <div key={s.id} className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                      s.status === "canceled"  ? "bg-red-50/60 border-red-100" :
                      s.status === "completed" ? "bg-green-50/60 border-green-100" :
                      "bg-white border-slate-200"
                    }`}>
                      {/* Time column */}
                      <div className="w-24 shrink-0">
                        {s.startAt ? (
                          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />{fmtTime(s.startAt)}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-300 italic">No time set</p>
                        )}
                        {s.endAt && <p className="text-xs text-slate-400 ml-4">{fmtTime(s.endAt)}</p>}
                      </div>
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{s.sectionName}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                          {s.programName && <span>{s.programName}</span>}
                          {coach && <span className="text-emerald-700 font-medium">{coach}</span>}
                          {location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{location}
                            </span>
                          )}
                        </div>
                        {s.canceledReason && (
                          <p className="text-xs text-red-500 mt-0.5">Reason: {s.canceledReason}</p>
                        )}
                      </div>
                      {/* Status badge */}
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${SESSION_STATUS_CLS[s.status] || "bg-slate-100 text-slate-500"}`}>
                        {s.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSections() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState("sections");
  const [programFilter, setProgramFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(null);

  const togglePublish = async (s, e) => {
    e.stopPropagation();
    setPublishing(s.id);
    try {
      await apiPatch(`/sections/${s.id}/publish`, {});
      qc.invalidateQueries({ queryKey: ["admin-sections"] });
      toast({ title: s.isPublished ? "Section unpublished" : "Section published" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(null);
    }
  };

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
        <div className="flex items-center gap-2">
          {view === "sections" && (
            <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Section
            </Button>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 mb-5 border border-slate-200 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("sections")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "sections" ? "bg-[#1a3c5e] text-white" : "text-slate-500 hover:text-slate-700"}`}>
          <List className="w-4 h-4" /> Sections
        </button>
        <button
          onClick={() => setView("board")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "board" ? "bg-[#1a3c5e] text-white" : "text-slate-500 hover:text-slate-700"}`}>
          <CalendarDays className="w-4 h-4" /> Schedule Board
        </button>
      </div>

      {view === "board" ? (
        <Card><CardContent className="p-6"><ScheduleBoard /></CardContent></Card>
      ) : (
      <>
      <div className="mb-4">
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-56"
          value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
          <option value="">All Programs</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.isPublished ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                          {s.isPublished ? "Published" : "Draft"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {s.programName}{s.subject ? ` · ${s.subject}` : ""}{s.gradeLevel ? ` · Grade ${s.gradeLevel}` : ""}{(s.coachFirstName || s.coachLastName) ? ` · ${s.coachFirstName ?? ""} ${s.coachLastName ?? ""}`.trim() : ""}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                        <span>{rosterCount} / {s.capacity} students</span>
                        {scheduleText && <span>{scheduleText}</span>}
                        {s.room && <span>{s.room}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => togglePublish(s, e)}
                        disabled={publishing === s.id}
                        className={`p-1.5 rounded transition-colors ${s.isPublished ? "text-blue-500 hover:bg-slate-100" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                        title={s.isPublished ? "Unpublish" : "Publish"}>
                        {publishing === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : s.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
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
      </>
      )}

      {(showModal || editing) && (
        <SectionModal
          initial={editing}
          programs={programs}
          coaches={coaches}
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
