import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

const Row = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
    <span className="text-sm text-slate-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
  </div>
);

export default function ApplicationDetailModal({ application: app, statusColors, onClose, onUpdated }) {
  const { user } = useAuth();
  const [decisionNotes, setDecisionNotes] = useState(app.decision_notes || "");
  const [saving, setSaving] = useState(false);

  const sc = statusColors[app.status] || "bg-slate-100 text-slate-500";

  const makeDecision = async (newStatus) => {
    setSaving(true);
    await base44.entities.Application.update(app.id, {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.email,
      decision_notes: decisionNotes,
    });

    // Write audit log
    await base44.entities.AuditLog.create({
      actor_user_id: user?.id,
      actor_email: user?.email,
      actor_role: user?.role,
      action: `application_${newStatus}`,
      resource_type: "Application",
      resource_id: app.id,
      description: `Application for ${app.student_first_name} ${app.student_last_name} marked as ${newStatus}`,
      metadata: JSON.stringify({ decision_notes: decisionNotes, program: app.program_interest }),
      timestamp: new Date().toISOString(),
      severity: newStatus === "approved" ? "info" : newStatus === "denied" ? "warning" : "info",
    });

    if (newStatus === "approved") {
      await handleApproval();
    } else {
      setSaving(false);
      onUpdated();
    }
  };

  const handleApproval = async () => {
    // 1. Create Parent record
    const parent = await base44.entities.Parent.create({
      user_email: app.email,
      full_name: `${app.parent_first_name} ${app.parent_last_name}`,
      phone: app.phone,
      student_ids: [],
      is_primary_contact: true,
      billing_email: app.email,
    });

    // 2. Create Student record
    const student = await base44.entities.Student.create({
      user_email: app.email,
      full_name: `${app.student_first_name} ${app.student_last_name}`,
      date_of_birth: app.student_birth_date,
      grade_level: app.student_grade,
      parent_ids: [parent.id],
      is_active: true,
      notes: app.notes || "",
    });

    // 3. Link parent -> student
    await base44.entities.Parent.update(parent.id, {
      student_ids: [student.id],
    });

    // 4. Create Enrollment (pending_payment)
    const enrollment = await base44.entities.Enrollment.create({
      student_id: student.id,
      student_email: app.email,
      program_name: app.program_interest,
      status: "pending_payment",
      payment_status: "unpaid",
      enrolled_date: new Date().toISOString().split("T")[0],
      notes: `Created from application ${app.id}`,
    });

    // 5. Back-link IDs onto Application
    await base44.entities.Application.update(app.id, {
      created_parent_id: parent.id,
      created_student_id: student.id,
      created_enrollment_id: enrollment.id,
    });

    // 6. Audit log for approval creation
    await base44.entities.AuditLog.create({
      actor_user_id: user?.id,
      actor_email: user?.email,
      actor_role: user?.role,
      action: "enrollment_created_from_application",
      resource_type: "Enrollment",
      resource_id: enrollment.id,
      description: `Enrollment created for ${app.student_first_name} ${app.student_last_name} — ${app.program_interest}`,
      metadata: JSON.stringify({ application_id: app.id, parent_id: parent.id, student_id: student.id }),
      timestamp: new Date().toISOString(),
      severity: "info",
    });

    setSaving(false);
    onUpdated();
  };

  const canDecide = !["approved", "denied"].includes(app.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-[#1a3c5e] text-lg">
              {app.student_first_name} {app.student_last_name}
            </h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize mt-1 ${sc}`}>
              {app.status?.replace("_", " ")}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Parent / Guardian</p>
            <Row label="Name" value={`${app.parent_first_name} ${app.parent_last_name}`} />
            <Row label="Email" value={app.email} />
            <Row label="Phone" value={app.phone} />
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Student</p>
            <Row label="Name" value={`${app.student_first_name} ${app.student_last_name}`} />
            <Row label="Date of Birth" value={app.student_birth_date} />
            <Row label="Age" value={app.student_age} />
            <Row label="Grade" value={app.student_grade} />
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Program</p>
            <Row label="Program Interest" value={app.program_interest} />
            {app.notes && <Row label="Notes" value={app.notes} />}
          </div>

          {app.submitted_at && (
            <p className="text-xs text-slate-400">
              Submitted {format(new Date(app.submitted_at), "MMM d, yyyy 'at' h:mm a")}
              {app.reviewed_by && ` · Reviewed by ${app.reviewed_by}`}
            </p>
          )}

          {app.created_enrollment_id && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
              ✓ Enrollment created (ID: {app.created_enrollment_id}) — status: <strong>pending_payment</strong>
            </div>
          )}

          {canDecide && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Decision Notes</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[70px]"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Add any notes about this decision…"
              />
            </div>
          )}

          {!canDecide && app.decision_notes && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Decision Notes</p>
              <p className="text-slate-700">{app.decision_notes}</p>
            </div>
          )}
        </div>

        {canDecide && (
          <div className="flex flex-wrap justify-end gap-3 px-6 py-4 border-t">
            <Button
              variant="outline"
              className="text-purple-700 border-purple-200 hover:bg-purple-50"
              onClick={() => makeDecision("waitlisted")}
              disabled={saving}
            >
              <Clock className="w-4 h-4 mr-2" />Waitlist
            </Button>
            <Button
              variant="outline"
              className="text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => makeDecision("denied")}
              disabled={saving}
            >
              <XCircle className="w-4 h-4 mr-2" />Deny
            </Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={() => makeDecision("approved")}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve & Enroll
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}