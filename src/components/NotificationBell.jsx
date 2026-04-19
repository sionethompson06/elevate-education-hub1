import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { Bell } from "lucide-react";
import { format } from "date-fns";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => apiGet("/notifications/unread-count"),
    refetchInterval: 30000,
  });

  const { data: notifsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet("/notifications"),
    enabled: open,
  });

  const unread = countData?.count || 0;
  const notifications = notifsData?.notifications || [];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await apiPost("/notifications/mark-all-read", {});
    qc.invalidateQueries({ queryKey: ["notif-count"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-300" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="font-semibold text-slate-800 text-sm">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No notifications yet.</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 text-sm ${n.isRead ? "bg-white" : "bg-blue-50"}`}>
                  <p className={`font-medium ${n.isRead ? "text-slate-700" : "text-blue-900"}`}>{n.title}</p>
                  {n.body && <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-slate-400 text-xs mt-1">
                    {n.createdAt ? format(new Date(n.createdAt), "MMM d 'at' h:mm a") : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
