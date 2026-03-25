import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { X, CheckCircle, XCircle, Clock, Loader2, Mail, Pencil, Save } from "lucide-react";
import { format } from "date-fns";

const Row = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
    <span className="text-sm text-slate-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-slate-800 text-right">{value || "—"}</span>
  </div>
);

export default function ApplicationDetailModal({ application: initialApp, statusColors, onClose, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [app, setApp] = useState(initialApp);
  const [decisionNotes, setDecisionNotes] = useState(initialApp.decision_notes || "");
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Editable parent contact state — seeded from app record
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    full_name: `${initialApp.parent_first_name} ${initialApp.parent_last_name}`,
    email: initialApp.email || "",
    phone: initialApp.phone || "",
  });
  const [savingContact, setSavingContact] = useState(false);

  const sc = statusColors[app.status] || "bg-slate-100 text-slate-500";

  const saveContact = async () => {
    setSavingContact(true);
    const nameParts = contactForm.full_name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Update the Application record
    await base44.entities.Application.update(app.id, {
      parent_first_name: firstName,
      parent_last_name: lastName,
      email: contactForm.email,
      phone: contactForm.phone,
      applicant_email: contactForm.email,
    });

    // If a Parent record was already created on approval, update it too
    if (app.created_parent_id) {
      await base44.entities.Parent.update(app.created_parent_id, {
        full_name: contactForm.full_name.trim(),
        user_email: contactForm.email,
        phone: contactForm.phone,
        billing_email: contactForm.email,
      });
    }

    setApp(prev => ({
      ...prev,
      parent_first_name: firstName,
      parent_last_name: lastName,
      email: contactForm.email,
      phone: contactForm.phone,
    }));

    setEditingContact(false);
    setSavingContact(false);
    toast({ title: "Contact info updated" });
  };

  const sendInvite = async () => {
    setInviting(true);
    try {
      const res = await base44.functions.invoke("inviteAndSetRole", { email: contactForm.email, role: "parent" });
      const result = res.data;
      if (result.warning) {
        toast({ title: "Invitation sent", description: result.warning });
      } else {
        toast({
          title: "Invitation sent!",
          description: `Login invite emailed to ${contactForm.email} with parent access.`,
        });
      }
    } catch (err) {
      toast({
        title: "Invite failed",
        description: err.message || "Could not send invite. The user may already have an account.",
        variant: "destructive",
      });
    }
    setInviting(false);
  };

  const makeDecision = async (newStatus) => {
    setSaving(true);
    await base44.entities.Application.update(app.id, {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.email,
      decision_notes: decisionNotes,
    });

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
      severity: newStatus === "denied" ? "warning" : "info",
    });

    if (newStatus === "approved") {
      await handleApproval();
    } else {
      setSaving(false);
      onUpdated();
    }
  };

  const handleApproval = async () => {
    const placeholderUserId = `pending_${app.id}`;
    const emailToUse = contactForm.email;
    const nameToUse = contactForm.full_name.trim();
    const nameParts = nameToUse.split(" ");

    // 1. Create Parent record
    const parent = await base44.entities.Parent.create({
      user_id: placeholderUserId,
      user_email: emailToUse,
      full_name: nameToUse,
      phone: contactForm.phone,
      student_ids: [],
      is_primary_contact: true,
      billing_email: emailToUse,
    });

    // 2. Create Student record
    const student = await base44.entities.Student.create({
      user_id: placeholderUserId,
      user_email: emailToUse,
      full_name: `${app.student_first_name} ${app.student_last_name}`,
      date_of_birth: app.student_birth_date,
      grade_level: app.student_grade,
      parent_ids: [parent.id],
      is_active: true,
      notes: app.notes || "",
    });

    // 3. Link parent -> student
    await base44.entities.Parent.update(parent.id, { student_ids: [student.id] });

    // 4. Try to find a matching Program
    const allPrograms = await base44.entities.Program.list("name", 100);
    const matchedProgram = allPrograms.find(p =>
      p.name?.toLowerCase().includes(app.program_interest?.toLowerCase()) ||
      app.program_interest?.toLowerCase().includes(p.name?.toLowerCase())
    );

    // 5. Create Enrollment
    const enrollment = await base44.entities.Enrollment.create({
      student_id: student.id,
      student_email: emailToUse,
      program_id: matchedProgram?.id || "pending",
      program_name: matchedProgram?.name || app.program_interest,
      status: "pending_payment",
      payment_status: "unpaid",
      enrolled_date: new Date().toISOString().split("T")[0],
      notes: `Created from application ${app.id}`,
    });

    // 6. Back-link IDs onto Application
    await base44.entities.Application.update(app.id, {
      created_parent_id: parent.id,
      created_student_id: student.id,
      created_enrollment_id: enrollment.id,
    });

    // 7. Invite parent with correct role
    try {
      await base44.functions.invoke("inviteAndSetRole", { email: emailToUse, role: "parent" });
      toast({
        title: "Invitation sent",
        description: `An invitation email was sent to ${emailToUse} with parent access.`,
      });
    } catch (inviteErr) {
      console.warn("Invite skipped (user may already exist):", inviteErr.message);
    }

    // 8. Audit log
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

          {/* Parent / Guardian — editable */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Parent / Guardian</p>
              {!editingContact && (
                <button
                  onClick={() => setEditingContact(true)}
                  className="text-xs text-[#1a3c5e] flex items-center gap-1 hover:underline"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {editingContact ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    value={contactForm.full_name}
                    onChange={e => setContactForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    value={contactForm.email}
                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Phone</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                    value={contactForm.phone}
                    onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingContact(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                  <Button size="sm" onClick={saveContact} disabled={savingContact} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                    {savingContact ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Row label="Name" value={contactForm.full_name} />
                <Row label="Email" value={contactForm.email} />
                <Row label="Phone" value={contactForm.phone} />
              </>
            )}
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

          {/* Manual invite — uses contactForm.email so it's always up to date */}
          {app.status === "approved" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-800">Send Login Invitation</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Email <strong>{contactForm.email}</strong> a link to create their password and access the Parent Portal.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0"
                onClick={sendInvite}
                disabled={inviting}
              >
                {inviting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Mail className="w-4 h-4 mr-1.5" /> Send Invite</>
                }
              </Button>
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