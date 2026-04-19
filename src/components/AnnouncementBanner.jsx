import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Megaphone, X, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiGet("/announcements"),
    refetchInterval: 120000,
  });

  const visible = (data?.announcements || []).filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map(ann => (
        <div key={ann.id} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Megaphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900">{ann.title}</p>
                {ann.body && (
                  expanded === ann.id
                    ? <p className="text-xs text-blue-700 mt-1 whitespace-pre-wrap">{ann.body}</p>
                    : <p className="text-xs text-blue-700 mt-0.5 line-clamp-1">{ann.body}</p>
                )}
                <p className="text-xs text-blue-400 mt-1">
                  {ann.publishedAt ? format(new Date(ann.publishedAt), "MMM d, yyyy") : ""}
                  {ann.authorFirstName ? ` · From ${ann.authorFirstName} ${ann.authorLastName || ""}`.trim() : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {ann.body && ann.body.length > 60 && (
                <button
                  onClick={() => setExpanded(e => e === ann.id ? null : ann.id)}
                  className="p-1 rounded hover:bg-blue-100 text-blue-500"
                >
                  {expanded === ann.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                onClick={() => setDismissed(d => [...d, ann.id])}
                className="p-1 rounded hover:bg-blue-100 text-blue-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
