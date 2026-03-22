import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { BookOpen, Activity, Globe, Star, Check, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_CONFIG = {
  academic: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", border: "border-t-blue-500", badge: "bg-blue-100 text-blue-700", label: "Hybrid Microschool" },
  virtual_homeschool: { icon: Globe, color: "text-purple-600", bg: "bg-purple-50", border: "border-t-purple-500", badge: "bg-purple-100 text-purple-700", label: "Virtual Homeschool" },
  athletic: { icon: Activity, color: "text-orange-600", bg: "bg-orange-50", border: "border-t-orange-500", badge: "bg-orange-100 text-orange-700", label: "Performance Training" },
  combined: { icon: Star, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-t-yellow-500", badge: "bg-yellow-100 text-yellow-700", label: "Combination" },
};

// Programs that also have a one-time / annual option
const HAS_ANNUAL = ["academic", "athletic", "combined"];

export default function Programs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [enrollingId, setEnrollingId] = useState(null);
  const [billingChoice, setBillingChoice] = useState({}); // programId -> "monthly" | "annual"
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

  const getBillingCycle = (program) => billingChoice[program.id] || "monthly";

  const handleEnroll = async (program) => {
    setEnrollingId(program.id);
    setError(null);
    const billing_cycle = getBillingCycle(program);
    const res = await base44.functions.invoke("enrollment", {
      action: "enroll",
      program_id: program.id,
      billing_cycle,
    });
    setEnrollingId(null);

    if (res.data?.error) {
      if (res.data?.enrollment_id) {
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

  // Group programs by category for display
  const grouped = programs.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const categoryOrder = ["academic", "virtual_homeschool", "athletic", "combined"];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <p className="text-sm text-slate-500 mb-1">Parent Portal</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Programs & Enrollment</h1>
        <p className="text-slate-500 mt-1">Choose a program for your student. You'll complete payment on the next screen.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

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
        <div className="space-y-10">
          {categoryOrder.map(cat => {
            const catPrograms = grouped[cat];
            if (!catPrograms?.length) return null;
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            const isCombo = cat === "combined";

            return (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">{cfg.label}</h2>
                  {isCombo && (
                    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">SAVE 10%</span>
                  )}
                </div>

                {/* Description from first program in group */}
                <p className="text-sm text-slate-500 mb-4 -mt-2">{catPrograms[0].description}</p>

                {/* Features from first program */}
                {catPrograms[0].features?.length > 0 && (
                  <ul className="flex flex-wrap gap-x-6 gap-y-1.5 mb-5">
                    {catPrograms[0].features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Check className={`w-3.5 h-3.5 ${cfg.color} shrink-0`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Pricing cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catPrograms.map(program => {
                    const enrolled = getEnrollmentStatus(program.id);
                    const isEnrolling = enrollingId === program.id;
                    const cycle = getBillingCycle(program);
                    const hasAnnual = HAS_ANNUAL.includes(cat) && program.price_annual;
                    // Determine label for this card variant
                    const variantLabel = cat === "virtual_homeschool"
                      ? (program.price_monthly === 199 ? "1 Session / Week" : "2 Sessions / Week")
                      : cat === "combined"
                      ? program.name.replace("Combination: ", "").replace(" + Performance", "")
                      : null;

                    return (
                      <div key={program.id} className={`bg-white rounded-2xl border-2 ${cfg.border.replace("border-t-", "border-")} shadow-sm flex flex-col`}>
                        <div className="p-5 flex-1">
                          {variantLabel && (
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{variantLabel}</p>
                          )}

                          {/* Monthly price */}
                          <div className="mb-3">
                            <p className="text-3xl font-extrabold text-[#1a3c5e]">
                              ${program.price_monthly?.toLocaleString()}
                              <span className="text-base font-normal text-slate-400">/mo</span>
                            </p>
                            {hasAnnual && (
                              <p className="text-sm text-slate-500 mt-0.5">
                                or <span className="font-semibold text-slate-700">${program.price_annual?.toLocaleString()}</span> one-time
                              </p>
                            )}
                          </div>

                          {/* Billing toggle for programs with annual option */}
                          {hasAnnual && (
                            <div className="flex gap-2 mb-4">
                              {["monthly", "annual"].map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => setBillingChoice(prev => ({ ...prev, [program.id]: opt }))}
                                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-colors ${cycle === opt ? "bg-[#1a3c5e] text-white border-[#1a3c5e]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                                >
                                  {opt === "monthly" ? "Monthly" : "One-time"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="px-5 pb-5">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}