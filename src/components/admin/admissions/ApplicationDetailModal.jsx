import { useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [decisionNotes, setDecisionNotes] = useState(initialApp.reviewer_notes || "");
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(null);

  const [showDenyConfirm, setShowDenyConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showWaitlistConfirm, setShowWaitlistConfirm] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    full_name: `${initialApp.parent_first_name} ${initialApp.parent_last_name}`.trim(),
    email: initialApp.email || "",
    phone: initialApp.phone || "",
  });
  const [savingContact, setSavingContact] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState("");

  const canDecide = !["approved", "denied"].includes(app.status);

  const { data: programsData } = useQuery({
    queryKey: ["admin-programs-for-approval"],
    queryFn: () => apiGet("/programs").then(r => (r.programs || []).filter(p => p.status === "active")),
    enabled: canDecide,
  });
  const programs = programsData || [];

  const sc = statusColors[app.status] || "bg-slate-100 text-slate-500";

  const saveContact = async () => {
    setSavingContact(true);
    const nameParts = contactForm.full_name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    try {
      const res = await apiPatch(`/applications/${app.id}`, {
        parent_first_name: firstName,
        parent_last_name: lastName,
        email: contactForm.email,
        phone: contactForm.phone,
      });
      setApp(res.application);
      setEditingContact(false);
      toast({ title: "Contact info updated" });
    } catch (err) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  const sendInvite = async () => {
    setInviting(true);
    try {
      const nameParts = contactForm.full_name.trim().split(" ");
      const res = await apiPost("/users/invite", {
        email: contactForm.email,
        role: "parent",
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
      });
      const url = res.inviteUrl || res.registerUrl;
      if (url) setInviteUrl(url);
      toast({
        title: res.emailSent ? "Invitation sent!" : "Invitation created",
        description: res.emailSent
          ? `Login invite emailed to ${contactForm.email}.`
          : "Email not configured — use the link below.",
      });
    } catch (err) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const makeDecision = async (newStatus) => {
    setSaving(true);
    try {
      if (newStatus === "approved") {
        const res = await apiPost(`/applications/${app.id}/approve`, {
          decision_notes: decisionNotes,
          reviewed_by: user?.email,
          ...(selectedProgramId ? { programId: parseInt(selectedProgramId) } : {}),
        });
        setApp(res.application);
        if (res.inviteUrl) setInviteUrl(res.inviteUrl);
        if (res.enrolledProgramId) {
          toast({
            title: "Application approved!",
            description: `Parent account and student record created. Invite sent to ${res.parentUser?.email}.`,
          });
        } else {
          toast({
            title: "Application approved — no enrollment created",
            description: "No active program matched. Go to Enrollments → Create Enrollment to add one manually.",
            variant: "destructive",
          });
        }
        onUpdated();
      } else if (newStatus === "denied") {
        const res = await apiPost(`/applications/${app.id}/deny`, {
          decision_notes: decisionNotes,
        });
        setApp(res.application);
        toast({ title: "Application denied", description: "The applicant has been notified." });
        onUpdated();
      } else {
        const res = await apiPatch(`/applications/${app.id}`, {
          status: newStatus,
          decision_notes: decisionNotes,
        });
        setApp(res.application);
        toast({ title: `Application ${newStatus}` });
        onUpdated();
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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

          {app.created_date && (
            <p className="text-xs text-slate-400">
              Submitted {format(new Date(app.created_date), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}

          {/* Invite link if email not configured */}
          {inviteUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">Email not configured — share this invite link:</p>
              <div className="flex gap-2">
                <input readOnly value={inviteUrl} className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1.5 text-amber-800" />
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteUrl); toast({ title: "Copied!" }); }}
                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium rounded"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Manual re-invite button for already-approved applications */}
          {app.status === "approved" && !inviteUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-800">Resend Login Invitation</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Email <strong>{contactForm.email}</strong> a new invite link.
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
                  : <><Mail className="w-4 h-4 mr-1.5" /> Resend</>
                }
              </Button>
            </div>
          )}

          {canDecide && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Enroll in Program
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    (optional — auto-matched from "{app.program_interest || "—"}" if blank)
                  </span>
                </label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  value={selectedProgramId}
                  onChange={e => setSelectedProgramId(e.target.value)}
                >
                  <option value="">Auto-match from program interest…</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Decision Notes</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[70px]"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Add any notes about this decision…"
                />
              </div>
            </div>
          )}

          {!canDecide && app.reviewer_notes && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Decision Notes</p>
              <p className="text-slate-700">{app.reviewer_notes}</p>
            </div>
          )}
        </div>

        {canDecide && (
          <div className="flex flex-wrap justify-end gap-3 px-6 py-4 border-t">
            <Button
              variant="outline"
              className="text-purple-700 border-purple-200 hover:bg-purple-50"
              onClick={() => setShowWaitlistConfirm(true)}
              disabled={saving}
            >
              <Clock className="w-4 h-4 mr-2" />Waitlist
            </Button>
            <Button
              variant="outline"
              className="text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => setShowDenyConfirm(true)}
              disabled={saving}
            >
              <XCircle className="w-4 h-4 mr-2" />Deny
            </Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={() => setShowApproveConfirm(true)}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve & Enroll
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a parent account for {contactForm.email}, create a student record for {app.student_first_name} {app.student_last_name}, and send a login invitation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!selectedProgramId && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mx-1">
              No program selected — an enrollment will not be auto-created. Select a program above or create the enrollment manually afterward.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-700 hover:bg-green-800"
              onClick={() => { setShowApproveConfirm(false); makeDecision("approved"); }}
            >
              Approve & Enroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWaitlistConfirm} onOpenChange={setShowWaitlistConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Waitlist this application?</AlertDialogTitle>
            <AlertDialogDescription>
              {app.student_first_name} {app.student_last_name}'s application will be moved to the waitlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-700 hover:bg-purple-800"
              onClick={() => { setShowWaitlistConfirm(false); makeDecision("waitlisted"); }}
            >
              Move to Waitlist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDenyConfirm} onOpenChange={setShowDenyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny this application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the application as denied and notify {app.parent_first_name} {app.parent_last_name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { setShowDenyConfirm(false); makeDecision("denied"); }}
            >
              Deny Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
