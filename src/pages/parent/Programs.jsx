import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { BookOpen, Activity, Globe, Trophy, Star, Check, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CATEGORY_CONFIG = {
  academic: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", border: "border-t-blue-500", badge: "bg-blue-100 text-blue-700" },
  virtual_homeschool: { icon: Globe, color: "text-purple-600", bg: "bg-purple-50", border: "border-t-purple-500", badge: "bg-purple-100 text-purple-700" },
  athletic: { icon: Activity, color: "text-orange-600", bg: "bg-orange-50", border: "border-t-orange-500", badge: "bg-orange-100 text-orange-700" },
  college_nil: { icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-t-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  combined: { icon: Star, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-t-yellow-500", badge: "bg-yellow-100 text-yellow-700" },
};

const CATEGORY_LABELS = {
  academic: "Academic",
  virtual_homeschool: "Homeschool",
  athletic: "Athletic",
  college_nil: "College & NIL",
  combined: "Full Package",
};

export default function Programs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [enrollingId, setEnrollingId] = useState(null);
  const [error, setError] = useState(null);

  const { data: programData, isLoading: programsLoading } = useQuery({
    queryKey: ["parent-programs"],
    queryFn: () => base44.functions.invoke("enrollment", { action: "get_programs" }).then(r => r.data),
    enabled: !!user,
  });

  const { data: enrollmentData } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: () => base44.functions.invoke("enrollment", { action: "get_my_enrollments" }).then(r => r.data),
    enabled: !!user,
  });

  const programs = programData?.programs || [];
  const myEnrollments = enrollmentData?.enrollments || [];

  const getEnrollmentStatus = (programId) => {
    return myEnrollments.find(e => e.program_id === programId && ["active", "active_override", "pending_payment"].includes(e.status));
  };

  const handleEnroll = async (program) => {
    setEnrollingId(program.id);
    setError(null);
    const res = await base44.functions.invoke("enrollment", {
      action: "enroll",
      program_id: program.id,
      billing_cycle: "monthly",
    });
    setEnrollingId(null);

    if (res.data?.error) {
      if (res.data?.enrollment_id) {
        // Already enrolled — go to checkout to pay
        navigate(`/parent/checkout?enrollment_id=${res.data.enrollment_id}`);
      } else {
        setError(res.data.error);
      }
      return;
    }

    if (res.data?.enrollment) {
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      navigate(`/parent/checkout?enrollment_id=${res.data.enrollment.id}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Programs & Enrollment</h1>
        <p className="text-slate-500 mt-1">Choose programs for your student. Enrollment creates a pending record — you'll pay on the next screen.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Already enrolled summary */}
      {myEnrollments.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Current Enrollments</p>
          <div className="flex flex-wrap gap-2">
            {myEnrollments.map(e => (
              <span key={e.id} className={`text-xs px-2 py-1 rounded-full font-medium ${e.status === "active" || e.status === "active_override" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                {e.program_name} — {e.status.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {programsLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map(program => {
            const cfg = CATEGORY_CONFIG[program.category] || CATEGORY_CONFIG.academic;
            const Icon = cfg.icon;
            const enrolled = getEnrollmentStatus(program.id);
            const isEnrolling = enrollingId === program.id;
            const savingsPct = program.price_monthly && program.price_annual
              ? Math.round(((program.price_monthly * 12 - program.price_annual) / (program.price_monthly * 12)) * 100)
              : 0;

            return (
              <div key={program.id} className={`bg-white rounded-2xl border border-slate-100 border-t-4 ${cfg.border} shadow-sm flex flex-col`}>
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.badge}`}>
                      {CATEGORY_LABELS[program.category]}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base mb-2">{program.name}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{program.description}</p>

                  {/* Pricing */}
                  <div className="flex items-end gap-3 mb-4">
                    {program.price_monthly && (
                      <div>
                        <p className="text-2xl font-bold text-[#1a3c5e]">${program.price_monthly}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                        {program.price_annual && (
                          <p className="text-xs text-slate-400">or ${program.price_annual}/yr {savingsPct > 0 && <span className="text-green-600 font-medium">· Save {savingsPct}%</span>}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  {program.features?.length > 0 && (
                    <ul className="space-y-1.5 mb-4">
                      {program.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <Check className={`w-3.5 h-3.5 ${cfg.color} shrink-0 mt-0.5`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* CTA */}
                <div className="px-6 pb-6">
                  {enrolled ? (
                    enrolled.status === "pending_payment" ? (
                      <a href={`/parent/checkout?enrollment_id=${enrolled.id}`}>
                        <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white">
                          Complete Payment <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
                        <Check className="w-4 h-4" /> Enrolled & Active
                      </div>
                    )
                  ) : (
                    <Button
                      className="w-full bg-[#1a3c5e] hover:bg-[#0d2540]"
                      onClick={() => handleEnroll(program)}
                      disabled={isEnrolling}
                    >
                      {isEnrolling ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enrolling…</>
                      ) : (
                        <>Enroll Now <ChevronRight className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}