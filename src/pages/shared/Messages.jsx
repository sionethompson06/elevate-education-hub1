import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/apiClient";
import { MessageCircle, Send, Inbox, ChevronLeft, Reply, Trash2, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-700",
  parent: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
  academic_coach: "bg-emerald-100 text-emerald-700",
  performance_coach: "bg-orange-100 text-orange-700",
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("inbox");
  const [composing, setComposing] = useState(false);
  const [composeForm, setComposeForm] = useState({ toUserId: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

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

  const { data: contactsData = { contacts: [], groups: [] } } = useQuery({
    queryKey: ["messages-contacts", user?.id],
    queryFn: () => apiGet("/messages/contacts"),
    enabled: !!user && composing,
  });
  const contacts = contactsData.contacts || [];
  const contactGroups = contactsData.groups || [];

  const { data: thread = [], refetch: refetchThread } = useQuery({
    queryKey: ["message-thread", selectedMsg?.id],
    queryFn: () => apiGet(`/messages/${selectedMsg.id}/thread`).then(r => r.thread || []),
    enabled: !!selectedMsg,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ["messages-search", debouncedSearch],
    queryFn: () => apiGet(`/messages/search?q=${encodeURIComponent(debouncedSearch)}`).then(r => r.messages || []),
    enabled: debouncedSearch.length > 0,
  });

  const markRead = useCallback(async (msgId) => {
    try {
      await apiPatch(`/messages/${msgId}/read`, {});
      qc.invalidateQueries({ queryKey: ["messages-inbox"] });
    } catch {}
  }, [qc]);

  const openMessage = (m) => {
    setSelectedMsg(m);
    setReplyBody("");
    if (!m.isRead && tab === "inbox") markRead(m.id);
  };

  const deleteMessage = async (msgId, e) => {
    e.stopPropagation();
    try {
      await apiDelete(`/messages/${msgId}`);
      qc.invalidateQueries({ queryKey: ["messages-inbox"] });
      qc.invalidateQueries({ queryKey: ["messages-sent"] });
      if (selectedMsg?.id === msgId) setSelectedMsg(null);
    } catch {}
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !selectedMsg) return;
    setReplying(true);
    try {
      await apiPost(`/messages/${selectedMsg.id}/reply`, { body: replyBody.trim() });
      setReplyBody("");
      refetchThread();
      qc.invalidateQueries({ queryKey: ["messages-sent"] });
    } catch {}
    setReplying(false);
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
                  {contactGroups.length > 0
                    ? contactGroups.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.contacts.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.firstName} {c.lastName}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    : contacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} ({c.role?.replace(/_/g, " ")})
                        </option>
                      ))
                  }
                </select>
                {composeForm.toUserId && contacts.length > 0 && (() => {
                  const sel = contacts.find(c => String(c.id) === String(composeForm.toUserId));
                  const grp = contactGroups.find(g => g.contacts.some(c => String(c.id) === String(composeForm.toUserId)));
                  return sel ? (
                    <p className="text-xs text-slate-400 mt-1">
                      {grp ? grp.label : sel.role?.replace(/_/g, " ")} · {sel.firstName} {sel.lastName}
                    </p>
                  ) : null;
                })()}
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

  if (selectedMsg) {
    const senderName = `${thread[0]?.senderFirstName || ""} ${thread[0]?.senderLastName || ""}`.trim() || "Unknown";
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedMsg(null)} className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <h1 className="text-xl font-bold text-[#1a3c5e] truncate flex-1">{selectedMsg.subject}</h1>
        </div>

        <div className="space-y-3">
          {thread.map((m, i) => {
            const name = `${m.senderFirstName || ""} ${m.senderLastName || ""}`.trim() || "Unknown";
            const isMe = m.fromUserId === user?.id;
            return (
              <div key={m.id} className={`rounded-xl p-4 ${isMe ? "bg-[#1a3c5e]/5 ml-6" : "bg-slate-50 mr-6"}`}>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{isMe ? "You" : name}</span>
                    {m.senderRole && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.senderRole] || "bg-slate-100 text-slate-600"}`}>
                        {m.senderRole.replace(/_/g, " ")}
                      </span>
                    )}
                    {i > 0 && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Reply</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {m.createdAt ? format(new Date(m.createdAt), "MMM d 'at' h:mm a") : ""}
                    </span>
                    <button
                      onClick={(e) => deleteMessage(m.id, e)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-colors"
                      title="Archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <Reply className="w-3.5 h-3.5" /> Reply
          </p>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[80px] resize-none"
            placeholder="Write your reply..."
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-[#1a3c5e] hover:bg-[#0d2540]"
              disabled={!replyBody.trim() || replying}
              onClick={handleReply}
            >
              {replying ? "Sending..." : <><Send className="w-3.5 h-3.5 mr-1.5" /> Send Reply</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isSearching = debouncedSearch.length > 0;
  const baseMessages = tab === "inbox" ? inbox : sent;
  const displayMessages = isSearching ? searchResults : baseMessages;
  const isLoading = isSearching ? searchLoading : (tab === "inbox" ? inboxLoading : sentLoading);

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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {["inbox", "sent"].map(t => (
            <button key={t} onClick={() => { setTab(t); setSearchInput(""); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t && !isSearching ? "bg-[#1a3c5e] text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-[#1a3c5e]"}`}>
              {t === "inbox" ? <><Inbox className="w-4 h-4 inline mr-1.5" />Inbox</> : <><Send className="w-4 h-4 inline mr-1.5" />Sent</>}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[180px] max-w-sm relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
          />
          {searchInput && (
            <button onClick={() => setSearchInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
          ) : displayMessages.length === 0 ? (
            <div className="py-12 text-center">
              <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                {isSearching ? `No results for "${debouncedSearch}".` : `No messages in ${tab}.`}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {displayMessages.map(m => {
                const isInbox = tab === "inbox" || isSearching;
                const name = isInbox
                  ? `${m.senderFirstName || ""} ${m.senderLastName || ""}`.trim() || "Unknown"
                  : `${m.recipientFirstName || ""} ${m.recipientLastName || ""}`.trim() || "Unknown";
                const role = isInbox ? m.senderRole : m.recipientRole;
                const unread = isInbox && !m.isRead;

                return (
                  <div
                    key={m.id}
                    className={`px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors group ${unread ? "bg-blue-50/40" : ""}`}
                    onClick={() => openMessage(m)}
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
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">
                          {m.createdAt ? format(new Date(m.createdAt), "MMM d") : ""}
                        </span>
                        <button
                          onClick={(e) => deleteMessage(m.id, e)}
                          className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
