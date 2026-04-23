import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Mail, Send, User, Users, Calendar, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiPatch } from "@/api/apiClient";
import CoachAssignmentPanel from "./CoachAssignmentPanel";
import CoachSchedulePanel from "./CoachSchedulePanel";
import CoachGradebookPanel from "./CoachGradebookPanel";

const TABS = [
  { id: "profile", label: "Profile", Icon: User },
  { id: "students", label: "Students", Icon: Users },
  { id: "schedule", label: "Schedule", Icon: Calendar },
  { id: "gradebook", label: "Gradebook", Icon: BookOpen },
];

const TYPE_LABELS = {
  academic_coach: "Academic Coach",
  performance_coach: "Performance Coach",
};

const STATUS_DOT = {
  active: "bg-green-500",
  invited: "bg-amber-400",
  expired: "bg-slate-400",
  inactive: "bg-slate-300",
};

export default function CoachDetailDrawer({ coach, onClose, onRefresh }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: coach.firstName,
    lastName: coach.lastName,
    email: coach.email,
    title: coach.profile?.title || "",
    bio: coach.profile?.bio || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["coach-detail", coach.id],
    queryFn: () => apiGet(`/coaches/${coach.id}`),
  });
  const detail = detailData?.coach || coach;

  const handleResendInvite = async () => {
    setInviting(true);
    setInviteMsg("");
    try {
      await apiPost(`/coaches/${coach.id}/invite`, {});
      setInviteMsg("Invite sent successfully.");
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
    } catch (err) {
      setInviteMsg("Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      await apiPatch(`/users/${coach.id}`, {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
      });
      if (profileForm.title !== undefined || profileForm.bio !== undefined) {
        await apiPost(`/staff-assignments/profiles`, {
          userId: coach.id,
          title: profileForm.title || null,
          bio: profileForm.bio || null,
        }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
      qc.invalidateQueries({ queryKey: ["coach-detail", coach.id] });
      setEditProfile(false);
      onRefresh?.();
    } catch (err) {
      setProfileError(err.message || "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const portalPath = coach.role === "academic_coach"
    ? "/academic-coach/dashboard"
    : "/performance-coach/dashboard";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white h-full w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${coach.role === "academic_coach" ? "bg-emerald-600" : "bg-orange-500"}`}>
              {`${coach.firstName?.[0] || ""}${coach.lastName?.[0] || ""}`.toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base leading-tight">{coach.firstName} {coach.lastName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${coach.role === "academic_coach" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                  {TYPE_LABELS[coach.role] || coach.role}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[coach.coachStatus] || "bg-slate-300"}`} />
                  {coach.coachStatus}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a href={portalPath} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#1a3c5e]" title="View portal">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0 px-2">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === id
                  ? "border-[#1a3c5e] text-[#1a3c5e]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              {inviteMsg && (
                <p className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded px-3 py-2">{inviteMsg}</p>
              )}

              {/* Invite action */}
              <div className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{detail.email || coach.email}</p>
                    <p className="text-xs text-slate-400">Email address</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 border-slate-300"
                  onClick={handleResendInvite}
                  disabled={inviting}
                >
                  {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Send Invite</>}
                </Button>
              </div>

              {!editProfile ? (
                <>
                  <div className="space-y-3">
                    <InfoRow label="First Name" value={detail.firstName || coach.firstName} />
                    <InfoRow label="Last Name" value={detail.lastName || coach.lastName} />
                    <InfoRow label="Role" value={TYPE_LABELS[coach.role] || coach.role} />
                    <InfoRow label="Title" value={detail.profile?.title || "—"} />
                    <InfoRow label="Bio" value={detail.profile?.bio || "—"} />
                    <InfoRow label="Member Since" value={new Date(coach.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
                  </div>
                  <Button size="sm" variant="outline" className="border-[#1a3c5e] text-[#1a3c5e] text-xs" onClick={() => setEditProfile(true)}>
                    Edit Profile
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  {profileError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{profileError}</p>}
                  <FormField label="First Name" value={profileForm.firstName} onChange={v => setProfileForm(f => ({ ...f, firstName: v }))} />
                  <FormField label="Last Name" value={profileForm.lastName} onChange={v => setProfileForm(f => ({ ...f, lastName: v }))} />
                  <FormField label="Email" value={profileForm.email} type="email" onChange={v => setProfileForm(f => ({ ...f, email: v }))} />
                  <FormField label="Title" value={profileForm.title} onChange={v => setProfileForm(f => ({ ...f, title: v }))} placeholder="e.g. Head Math Coach" />
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Bio</label>
                    <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none" value={profileForm.bio} onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditProfile(false)} disabled={savingProfile} className="flex-1 text-xs">Cancel</Button>
                    <Button size="sm" className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540] text-white text-xs" onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Saving…</> : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "students" && <CoachAssignmentPanel coach={coach} />}
          {activeTab === "schedule" && <CoachSchedulePanel coach={coach} />}
          {activeTab === "gradebook" && <CoachGradebookPanel coach={coach} />}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm border-b border-slate-50 pb-2">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-slate-800 text-xs font-medium text-right max-w-[60%] break-words">{value || "—"}</span>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
