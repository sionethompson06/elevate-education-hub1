import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const ROLES = [
  { value: "user",              label: "User / Parent",     desc: "Default role for parents/guardians" },
  { value: "parent",            label: "Parent",            desc: "Parent portal access" },
  { value: "student",           label: "Student",           desc: "Student portal access" },
  { value: "academic_coach",    label: "Academic Coach",    desc: "Academic coach portal access" },
  { value: "performance_coach", label: "Performance Coach", desc: "Performance coach portal access" },
  { value: "admin",             label: "Admin",             desc: "Full admin access" },
];

export default function InviteUserModal({ onClose, onInvited }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("inviteAndSetRole", { email: email.trim(), role });
      const result = res.data;

      if (result.warning) {
        toast({ title: "Invitation sent", description: result.warning });
      } else {
        toast({ title: "Invitation sent!", description: `Invite emailed to ${email}. Role: ${role}.` });
      }
      onInvited();
    } catch (err) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-[#1a3c5e] text-lg">Invite New User</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Assign Role</label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    role === r.value
                      ? "border-[#1a3c5e] bg-[#1a3c5e]/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${role === r.value ? "text-[#1a3c5e]" : "text-slate-800"}`}>{r.label}</p>
                    <p className="text-xs text-slate-400">{r.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    role === r.value ? "border-[#1a3c5e] bg-[#1a3c5e]" : "border-slate-300"
                  }`}>
                    {role === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            The user will receive an email with a link to set their password and access the portal.
            {["academic_coach", "performance_coach"].includes(role) && (
              <span className="block mt-1 text-blue-600">You can assign students to this coach after they accept the invite.</span>
            )}
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <Button
            className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]"
            onClick={handleInvite}
            disabled={sending || !email.trim()}
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Invite
          </Button>
        </div>
      </div>
    </div>
  );
}