import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_COLORS = {
  academic: { bar: "bg-blue-600", title: "text-blue-600" },
  virtual_homeschool: { bar: "bg-purple-600", title: "text-purple-600" },
  athletic: { bar: "bg-red-600", title: "text-red-600" },
  combined: { bar: "bg-yellow-500", title: "text-yellow-600" },
};

export default function Programs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [enrollingId, setEnrollingId] = useState(null);
  const [billingChoice, setBillingChoice] = useState({});
  const [error, setError] = useState(null);

  const { data: programData, isLoading: programsLoading } = useQuery({
    queryKey: ["parent-programs"],
    queryFn: () => apiGet('/programs'),
    enabled: !!user,
  });

  const { data: myStudentsData } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: () => apiGet('/enrollments/my-students'),
    enabled: !!user,
  });

  const programs = programData?.programs || [];
  const myEnrollments = myStudentsData?.enrollments || [];

  const getEnrollmentStatus = (programId) => {
    return myEnrollments.find(e => (e.programId ?? e.program_id) === programId && ["active", "active_override", "pending_payment", "pending"].includes(e.status));
  };

  const getBillingCycle = (program) => billingChoice[program.id] || "monthly";

  const handleEnroll = async (program) => {
    setEnrollingId(program.id);
    setError(null);
    const studentId = myStudentsData?.students?.[0]?.id;
    if (!studentId) {
      setError('No student found on your account. Please contact support.');
      setEnrollingId(null);
      return;
    }
    try {
      const res = await apiPost('/enrollments', {
        studentId,
        programId: program.id,
        billingCycle: getBillingCycle(program),
      });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      if (res.enrollment) {
        navigate(`/parent/checkout?enrollment_id=${res.enrollment.id}`);
      }
    } catch (err) {
      setError(err.message || 'Enrollment failed. Please try again.');
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Programs</h1>
        <p className="text-slate-500 text-lg">Explore and enroll your students in our programs</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {myEnrollments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Your Active Enrollments</p>
          <div className="flex flex-wrap gap-2">
            {myEnrollments.map(e => (
              <span key={e.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${e.status === "active" || e.status === "active_override" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                {e.program_name}
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
        <div className="space-y-4">
          {programs.map(program => {
            const colors = CATEGORY_COLORS[program.category] || CATEGORY_COLORS.academic;
            const enrolled = getEnrollmentStatus(program.id);
            const isEnrolling = enrollingId === program.id;
            const cycle = getBillingCycle(program);
            const hasAnnual = program.price_annual;

            // Get variant label for virtual homeschool or combined programs
            const getVariantLabel = () => {
              if (program.category === "virtual_homeschool") {
                return program.price_monthly === 199 ? "1 Session / Week" : "2 Sessions / Week";
              }
              if (program.category === "combined") {
                return program.name.replace("Combination: ", "").replace(" + Performance", "");
              }
              return null;
            };

            const variantLabel = getVariantLabel();

            return (
              <div key={program.id} className="border-l-4 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                {/* Colored top bar */}
                <div className={`h-1.5 ${colors.bar}`} />

                <div className="p-6">
                  {/* Title and variant */}
                  <div className="mb-4">
                    <h3 className={`text-lg font-bold ${colors.title} mb-1`}>{program.name}</h3>
                    {variantLabel && (
                      <p className="text-sm text-slate-500">{variantLabel}</p>
                    )}
                  </div>

                  {/* Main content: description, features on left; pricing on right */}
                  <div className="flex gap-8">
                    <div className="flex-1 min-w-0">
                      {/* Description */}
                      <p className="text-sm text-slate-700 leading-relaxed mb-4">{program.description}</p>

                      {/* Features in 2 columns */}
                      {program.features?.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {program.features.map((f, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                              <span className="text-sm text-slate-700">{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pricing and CTA */}
                    <div className="shrink-0 text-right min-w-max">
                      <div className="mb-6">
                        {/* Monthly option */}
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">
                            {hasAnnual ? "Monthly" : "Price"}
                          </p>
                          <p className="text-4xl font-bold text-slate-900">
                            ${program.price_monthly?.toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-500">/month</p>
                        </div>

                        {/* Annual option (if available) */}
                        {hasAnnual && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">
                              One-time
                            </p>
                            <p className="text-3xl font-bold text-slate-900">
                              ${program.price_annual?.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Billing toggle */}
                      {hasAnnual && (
                        <div className="flex gap-2 mb-6">
                          {["monthly", "annual"].map(opt => (
                            <button
                              key={opt}
                              onClick={() => setBillingChoice(prev => ({ ...prev, [program.id]: opt }))}
                              className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-colors ${cycle === opt ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                            >
                              {opt === "monthly" ? "Mo" : "1x"}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* CTA */}
                      {enrolled ? (
                        enrolled.status === "pending_payment" ? (
                          <a href={`/parent/checkout?enrollment_id=${enrolled.id}`}>
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                              Complete Payment <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                          </a>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
                            <Check className="w-4 h-4" /> Enrolled
                          </div>
                        )
                      ) : (
                        <Button
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                          onClick={() => handleEnroll(program)}
                          disabled={isEnrolling}
                        >
                          {isEnrolling ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enrolling…</>
                          ) : (
                            <>Enroll a Student <ChevronRight className="w-4 h-4 ml-2" /></>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}