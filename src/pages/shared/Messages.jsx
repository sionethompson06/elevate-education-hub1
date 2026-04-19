import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/api/apiClient";
import { MessageCircle, Send, Inbox, User, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-700",
  parent: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
  academic_coach: "bg-emerald-100 text-emerald-700",
  performance_coach: "bg-orange-100 text-orange-700",
};

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("inbox");
  const [composing, setComposing] = useState(false);
  const [composeForm, setComposeForm] = useState({ toUserId: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const { data: inbox = [], isLoading: inboxLoading } = useQuery({
    queryKey: ["messages-inbox", user?.id],
    queryFn: () => apiGet("/messages/inbox").then(r => r.messages || []),
    enabled: !!user && tab === "inbox",
  });

  const { data: sent = [], isLoading: sentLoading } = useQuery({
    queryKey: ["messages-sent", user?.id],
    queryFn: () => apiGet("/messages/sent").then(r => r.messages || []),
    enabled: !!user && tab === "sent",
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["messages-contacts", user?.id],
    queryFn: () => apiGet("/messages/contacts").then(r => r.contacts || []),
    enabled: !!user && composing,
  });

  const markRead = async (msgId) => {
    try {
      await apiPatch(`/messages/${msgId}/read`, {});
      qc.invalidateQueries({ queryKey: ["messages-inbox"] });
    } catch {}
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!composeForm.toUserId || !composeForm.subject.trim() || !composeForm.body.trim()) {
      setSendError("Please fill in all fields.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await apiPost("/messages", {
        toUserId: parseInt(composeForm.toUserId),
        subject: composeForm.subject.trim(),
        body: composeForm.body.trim(),
      });
      setComposing(false);
      setComposeForm({ toUserId: "", subject: "", body: "" });
      qc.invalidateQueries({ queryKey: ["messages-sent"] });
      setTab("sent");
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const messages = tab === "inbox" ? inbox : sent;
  const isLoading = tab === "inbox" ? inboxLoading : sentLoading;

  if (composing) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setComposing(false)} className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <h1 className="text-2xl font-bold text-[#1a3c5e]">New Message</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">To</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  value={composeForm.toUserId}
                  onChange={e => setComposeForm(f => ({ ...f, toUserId: e.target.value }))}
                  required
                >
                  <option value="">Select recipient...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.role?.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Subject</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  value={composeForm.subject}
                  onChange={e => setComposeForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Subject..."
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Message</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[120px] resize-none"
                  value={composeForm.body}
                  onChange={e => setComposeForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write your message..."
                  required
                />
              </div>
              {sendError && <p className="text-sm text-red-500">{sendError}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setComposing(false)} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={sending} className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
                  {sending ? "Sending..." : <><Send className="w-4 h-4 mr-2" /> Send</>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">Communications</p>
          <h1 className="text-3xl font-bold text-[#1a3c5e]">Messages</h1>
        </div>
        <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]" onClick={() => setComposing(true)}>
          <MessageCircle className="w-4 h-4 mr-2" /> New Message
        </Button>
      </div>

      <div className="flex gap-2">
        {["inbox", "sent"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-[#1a3c5e] text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-[#1a3c5e]"}`}>
            {t === "inbox" ? <><Inbox className="w-4 h-4 inline mr-1.5" />Inbox</> : <><Send className="w-4 h-4 inline mr-1.5" />Sent</>}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center">
              <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No messages in {tab}.</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map(m => {
                const isInbox = tab === "inbox";
                const name = isInbox
                  ? `${m.senderFirstName || ""} ${m.senderLastName || ""}`.trim() || "Unknown"
                  : `${m.recipientFirstName || ""} ${m.recipientLastName || ""}`.trim() || "Unknown";
                const role = isInbox ? m.senderRole : m.recipientRole;
                const unread = isInbox && !m.isRead;

                return (
                  <div
                    key={m.id}
                    className={`px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${unread ? "bg-blue-50/40" : ""}`}
                    onClick={() => isInbox && !m.isRead && markRead(m.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{name}</span>
                          {role && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role] || "bg-slate-100 text-slate-600"}`}>
                              {role.replace(/_/g, " ")}
                            </span>
                          )}
                          {unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                        </div>
                        <p className={`text-sm truncate ${unread ? "font-semibold text-slate-800" : "text-slate-700"}`}>{m.subject}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {m.createdAt ? format(new Date(m.createdAt), "MMM d") : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
