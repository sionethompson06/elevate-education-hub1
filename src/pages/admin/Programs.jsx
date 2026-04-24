import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { BookOpen, Plus, X, Pencil, Loader2, ToggleLeft, ToggleRight, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const PROGRAM_TYPES = ["academic", "athletic", "homeschool", "virtual", "combination", "other"];
const BILLING_CYCLES = ["monthly", "annual", "one_time"];

const EMPTY_FORM = { name: "", type: "academic", description: "", tuitionAmount: "", billingCycle: "monthly", status: "active" };

function ProgramModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || null,
        tuitionAmount: form.tuitionAmount ? String(form.tuitionAmount) : null,
        billingCycle: form.billingCycle,
        status: form.status,
      };
      if (initial?.id) {
        await apiPatch(`/programs/${initial.id}`, payload);
        toast({ title: "Program updated" });
      } else {
        await apiPost("/programs", payload);
        toast({ title: "Program created" });
      }
      onSaved();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#1a3c5e] text-lg">{initial?.id ? "Edit Program" : "Create Program"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Program Name *</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Academic Excellence" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none capitalize"
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {PROGRAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tuition Amount ($)</label>
              <input type="number" min="0" step="0.01"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                value={form.tuitionAmount} onChange={e => setForm(f => ({ ...f, tuitionAmount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.billingCycle} onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))}>
                {BILLING_CYCLES.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[70px] resize-none"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()} className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            {initial?.id ? "Save Changes" : "Create Program"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPrograms() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-programs-page"],
    queryFn: () => apiGet("/programs"),
  });
  const programs = data?.programs || [];

  const { data: enrollmentsData } = useQuery({
    queryKey: ["admin-enrollments-for-programs"],
    queryFn: () => apiGet("/enrollments"),
  });
  const allEnrollments = enrollmentsData?.enrollments || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-programs-page"] });
    qc.invalidateQueries({ queryKey: ["admin-programs-dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin-programs-for-approval"] });
    setShowModal(false);
    setEditing(null);
  };

  const toggleStatus = async (p) => {
    try {
      await apiPatch(`/programs/${p.id}`, { status: p.status === "active" ? "inactive" : "active" });
      invalidate();
      toast({ title: p.status === "active" ? "Program deactivated" : "Program activated" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/programs/${deleteTarget.id}`);
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Program deleted" });
    } catch (err) {
      // Surface the server's blocking reason in the dialog rather than a toast
      setDeleteTarget(prev => prev ? { ...prev, blockReason: err.message } : null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
          <h1 className="text-3xl font-bold text-[#1a3c5e] flex items-center gap-3"><BookOpen className="w-8 h-8" /> Programs</h1>
          <p className="text-slate-500 mt-1">Create and manage enrollment programs, pricing, and status.</p>
        </div>
        <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Program
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
          ) : programs.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm mb-3">No programs yet.</p>
              <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" /> Create First Program</Button>
            </div>
          ) : (
            <div className="divide-y">
              {programs.map(p => {
                const progEnrollments = allEnrollments.filter(e => e.programId === p.id);
                const activeCount  = progEnrollments.filter(e => ["active", "active_override"].includes(e.status)).length;
                const pendingCount = progEnrollments.filter(e => ["pending_payment", "pending"].includes(e.status)).length;
                const pastDueCount = progEnrollments.filter(e => ["past_due", "payment_failed"].includes(e.status)).length;
                const totalCount   = progEnrollments.length;
                const canDelete    = totalCount === 0;

                const deleteTooltip = !canDelete
                  ? [
                      activeCount  > 0 && `${activeCount} active`,
                      pendingCount > 0 && `${pendingCount} pending`,
                      pastDueCount > 0 && `${pastDueCount} past-due`,
                      (totalCount - activeCount - pendingCount - pastDueCount) > 0 && `${totalCount - activeCount - pendingCount - pastDueCount} other`,
                    ].filter(Boolean).join(", ") + " enrollment" + (totalCount > 1 ? "s" : "") + " — cannot delete"
                  : "Delete program";

                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {p.status}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">{p.type}</span>
                      </div>
                      {p.description && <p className="text-xs text-slate-500 truncate">{p.description}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {p.tuitionAmount && (
                          <span className="text-xs text-slate-600 font-medium">${parseFloat(p.tuitionAmount).toLocaleString()} / {p.billingCycle?.replace("_", " ")}</span>
                        )}
                        <span className="text-xs text-slate-400">
                          {activeCount > 0 && <span className="text-green-600 font-medium">{activeCount} active</span>}
                          {activeCount > 0 && pendingCount > 0 && <span> · </span>}
                          {pendingCount > 0 && <span className="text-yellow-600 font-medium">{pendingCount} pending</span>}
                          {(activeCount > 0 || pendingCount > 0) && pastDueCount > 0 && <span> · </span>}
                          {pastDueCount > 0 && <span className="text-red-500 font-medium">{pastDueCount} past-due</span>}
                          {totalCount === 0 && <span className="text-slate-400">No enrollments</span>}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleStatus(p)} title={p.status === "active" ? "Deactivate" : "Activate"}
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
                        {p.status === "active" ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => canDelete && setDeleteTarget(p)}
                        title={deleteTooltip}
                        disabled={!canDelete}
                        className={`p-1.5 rounded transition-colors ${canDelete ? "hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer" : "text-slate-200 cursor-not-allowed"}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {(showModal || editing) && (
        <ProgramModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={invalidate}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the program from the system. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget?.blockReason && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <p>{deleteTarget.blockReason}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            {!deleteTarget?.blockReason && (
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Program"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
