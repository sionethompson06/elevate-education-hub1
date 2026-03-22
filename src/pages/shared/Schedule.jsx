import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, isToday, isTomorrow, parseISO } from "date-fns";

const PROGRAM_COLORS = {
  academic: "bg-blue-100 text-blue-700 border-blue-200",
  homeschool: "bg-purple-100 text-purple-700 border-purple-200",
  athletic: "bg-orange-100 text-orange-700 border-orange-200",
  special_event: "bg-pink-100 text-pink-700 border-pink-200",
};

const PROGRAM_LABELS = {
  academic: "Academic",
  homeschool: "Homeschool",
  athletic: "Athletic",
  special_event: "Special Event",
};

const STATUS_COLORS = {
  scheduled: "bg-slate-100 text-slate-600",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
  no_show: "bg-yellow-100 text-yellow-700",
};

function dayLabel(dateStr) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMMM d");
}

export default function Schedule() {
  const { user } = useAuth();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: async () => {
      const filters = {};
      if (user?.role === "student") {
        const students = await base44.entities.Student.filter({ user_id: user.id });
        if (students[0]) filters.student_id = students[0].id;
      } else if (["academic_coach", "performance_coach"].includes(user?.role)) {
        filters.coach_user_id = user.id;
      }
      return base44.entities.Session.filter(filters, "scheduled_at", 50);
    },
    enabled: !!user,
  });

  // Group by day
  const grouped = sessions.reduce((acc, s) => {
    const day = s.scheduled_at?.slice(0, 10) || "unknown";
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">My Schedule</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Upcoming Sessions</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : days.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No sessions scheduled.</p>
            <p className="text-xs text-slate-300 mt-1">Sessions will appear here once your coach schedules them.</p>
          </CardContent>
        </Card>
      ) : (
        days.map(day => (
          <div key={day}>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{dayLabel(day)}</p>
            <div className="space-y-3">
              {grouped[day].map(s => (
                <Card key={s.id} className="border border-slate-100">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PROGRAM_COLORS[s.program_type] || "bg-slate-100 text-slate-600"}`}>
                            {PROGRAM_LABELS[s.program_type] || s.program_type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || "bg-slate-100 text-slate-600"}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800">{s.title}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.scheduled_at ? format(parseISO(s.scheduled_at), "h:mm a") : "—"} · {s.duration_minutes || 60} min</span>
                          {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                          {s.coach_email && <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.coach_email}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}