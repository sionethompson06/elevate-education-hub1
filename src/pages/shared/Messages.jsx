import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MessageCircle, Send, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const CHANNEL_LABELS = {
  parent_academic_coach: "Parent ↔ Academic Coach",
  parent_performance_coach: "Parent ↔ Performance Coach",
  student_staff: "Student ↔ Staff",
  admin_broadcast: "Announcements",
};

const CHANNEL_COLORS = {
  parent_academic_coach: "bg-blue-100 text-blue-700",
  parent_performance_coach: "bg-orange-100 text-orange-700",
  student_staff: "bg-purple-100 text-purple-700",
  admin_broadcast: "bg-red-100 text-red-700",
};

const ROLE_CHANNELS = {
  parent: ["parent_academic_coach", "parent_performance_coach", "admin_broadcast"],
  student: ["student_staff", "admin_broadcast"],
  academic_coach: ["parent_academic_coach", "student_staff"],
  performance_coach: ["parent_performance_coach", "student_staff"],
  admin: ["parent_academic_coach", "parent_performance_coach", "student_staff", "admin_broadcast"],
};

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeChannel, setActiveChannel] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);

  const channels = ROLE_CHANNELS[user?.role] || [];

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", user?.id, activeChannel],
    queryFn: () => {
      const filters = {};
      if (activeChannel) filters.channel = activeChannel;
      return base44.entities.Message.filter(filters, "-sent_at", 50);
    },
    enabled: !!user,
  });

  const handleSend = async () => {
    if (!newMsg.trim() || !activeChannel) return;
    setSending(true);
    await base44.entities.Message.create({
      from_user_id: user.id,
      from_email: user.email,
      from_name: user.full_name,
      body: newMsg.trim(),
      channel: activeChannel,
      message_type: activeChannel === "admin_broadcast" ? "announcement" : "direct",
      sent_at: new Date().toISOString(),
      is_read: false,
    });
    setNewMsg("");
    setSending(false);
    qc.invalidateQueries({ queryKey: ["messages", user?.id, activeChannel] });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Communications</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Messages</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Channel list */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Channels</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {channels.map(ch => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`w-full text-left px-4 py-3 text-sm border-b last:border-0 transition-colors ${activeChannel === ch ? "bg-[#1a3c5e] text-white" : "hover:bg-slate-50 text-slate-700"}`}
              >
                <div className="flex items-center gap-2">
                  {ch === "admin_broadcast" ? <Megaphone className="w-3.5 h-3.5 shrink-0" /> : <MessageCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="text-xs font-medium">{CHANNEL_LABELS[ch]}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Message thread */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm text-slate-700">
              {activeChannel ? CHANNEL_LABELS[activeChannel] : "Select a channel"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex flex-col">
            <div className="flex-1 overflow-y-auto max-h-96 divide-y">
              {!activeChannel ? (
                <p className="text-sm text-slate-400 text-center py-10">Choose a channel to view messages.</p>
              ) : isLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">No messages yet.</p>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`px-4 py-3 ${m.from_email === user?.email ? "bg-slate-50" : ""}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700">{m.from_name || m.from_email}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${CHANNEL_COLORS[m.channel] || "bg-slate-100 text-slate-500"}`}>{CHANNEL_LABELS[m.channel]}</span>
                      <span className="text-xs text-slate-400 ml-auto">{m.sent_at ? format(new Date(m.sent_at), "MMM d, h:mm a") : ""}</span>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))
              )}
            </div>
            {activeChannel && (
              <div className="p-4 border-t flex gap-2">
                <textarea
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message… (Enter to send)"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[60px]"
                />
                <Button onClick={handleSend} disabled={sending || !newMsg.trim()} className="bg-[#1a3c5e] hover:bg-[#0d2540] self-end">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}