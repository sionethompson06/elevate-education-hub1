import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp, BookOpen, Activity, GraduationCap, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

const PROGRAM_CONFIG = {
  academic: { label: "Academic Program", icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
  homeschool: { label: "Homeschool Support", icon: Home, color: "text-purple-600", bg: "bg-purple-50" },
  athletic: { label: "Athletic Performance", icon: Activity, color: "text-orange-600", bg: "bg-orange-50" },
  college_readiness: { label: "Recruitment & College Readiness", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50" },
};

const RATING_CONFIG = {
  excellent: { label: "Excellent", color: "text-green-700", bg: "bg-green-100" },
  on_track: { label: "On Track", color: "text-blue-700", bg: "bg-blue-100" },
  needs_support: { label: "Needs Support", color: "text-yellow-700", bg: "bg-yellow-100" },
  at_risk: { label: "At Risk", color: "text-red-700", bg: "bg-red-100" },
};

export default function Progress() {
  const { user } = useAuth();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["progress", user?.id, user?.role],
    queryFn: async () => {
      if (user?.role === "student") {
        const students = await base44.entities.Student.filter({ user_id: user.id });
        if (!students[0]) return [];
        return base44.entities.ProgressRecord.filter({ student_id: students[0].id }, "-period_start", 30);
      }
      if (user?.role === "parent") {
        const parents = await base44.entities.Parent.filter({ user_email: user.email });
        const parent = parents[0];
        if (!parent?.student_ids?.length) return [];
        const all = await Promise.all(parent.student_ids.map(sid =>
          base44.entities.ProgressRecord.filter({ student_id: sid }, "-period_start", 20)
        ));
        return all.flat();
      }
      if (["academic_coach", "performance_coach"].includes(user?.role)) {
        const type = user.role === "academic_coach" ? "academic_coach" : "performance_coach";
        const assignments = await base44.entities.CoachAssignment.filter({ coach_user_id: user.id, coach_type: type, is_active: true });
        if (!assignments.length) return [];
        const all = await Promise.all(assignments.map(a =>
          base44.entities.ProgressRecord.filter({ student_id: a.student_id }, "-period_start", 10)
        ));
        return all.flat();
      }
      if (user?.role === "admin") {
        return base44.entities.ProgressRecord.list("-period_start", 50);
      }
      return [];
    },
    enabled: !!user,
  });

  // Group by program_type
  const grouped = records.reduce((acc, r) => {
    if (!acc[r.program_type]) acc[r.program_type] = [];
    acc[r.program_type].push(r);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">My Progress</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Progress Reports</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No progress reports yet.</p>
            <p className="text-xs text-slate-300 mt-1">Reports will appear here as your coaches log your progress.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([ptype, recs]) => {
          const cfg = PROGRAM_CONFIG[ptype] || { label: ptype, icon: TrendingUp, color: "text-slate-600", bg: "bg-slate-50" };
          const Icon = cfg.icon;
          return (
            <div key={ptype}>
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${cfg.bg} w-fit`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className="space-y-3">
                {recs.map(r => {
                  const rating = RATING_CONFIG[r.overall_rating];
                  return (
                    <Card key={r.id} className="border border-slate-100">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <CardTitle className="text-base text-[#1a3c5e]">{r.period_label}</CardTitle>
                          {rating && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rating.bg} ${rating.color}`}>{rating.label}</span>}
                        </div>
                        <p className="text-xs text-slate-400">
                          {r.period_start && r.period_end ? `${format(new Date(r.period_start), "MMM d")} – ${format(new Date(r.period_end), "MMM d, yyyy")}` : ""}
                          {r.recorded_by ? ` · by ${r.recorded_by}` : ""}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        {r.summary && <p className="text-sm text-slate-700">{r.summary}</p>}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {r.attendance_rate != null && (
                            <div className="bg-slate-50 rounded-lg p-2">
                              <p className="text-lg font-bold text-slate-800">{Math.round(r.attendance_rate * 100)}%</p>
                              <p className="text-xs text-slate-400">Attendance</p>
                            </div>
                          )}
                          {r.completion_rate != null && (
                            <div className="bg-slate-50 rounded-lg p-2">
                              <p className="text-lg font-bold text-slate-800">{Math.round(r.completion_rate * 100)}%</p>
                              <p className="text-xs text-slate-400">Completion</p>
                            </div>
                          )}
                          {r.gpa_equivalent != null && (
                            <div className="bg-slate-50 rounded-lg p-2">
                              <p className="text-lg font-bold text-slate-800">{r.gpa_equivalent.toFixed(1)}</p>
                              <p className="text-xs text-slate-400">GPA Equiv.</p>
                            </div>
                          )}
                        </div>
                        {r.strengths && <div><p className="text-xs font-semibold text-green-600 mb-0.5">Strengths</p><p className="text-sm text-slate-600">{r.strengths}</p></div>}
                        {r.areas_for_growth && <div><p className="text-xs font-semibold text-yellow-600 mb-0.5">Areas for Growth</p><p className="text-sm text-slate-600">{r.areas_for_growth}</p></div>}
                        {r.goals_for_next_period && <div><p className="text-xs font-semibold text-blue-600 mb-0.5">Goals for Next Period</p><p className="text-sm text-slate-600">{r.goals_for_next_period}</p></div>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}