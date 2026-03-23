import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Loader2, AlertCircle, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "academic", label: "🏫 Academic" },
  { key: "virtual_homeschool", label: "💻 Virtual" },
  { key: "athletic", label: "🏆 Athletic" },
  { key: "combined", label: "🎯 Bundles" },
];

const CATEGORY_COLORS = {
  academic: { bar: "bg-blue-600", title: "text-blue-700", badge: "bg-blue-50 border-blue-200" },
  virtual_homeschool: { bar: "bg-purple-600", title: "text-purple-700", badge: "bg-purple-50 border-purple-200" },
  athletic: { bar: "bg-red-600", title: "text-red-700", badge: "bg-red-50 border-red-200" },
  combined: { bar: "bg-teal-500", title: "text-teal-700", badge: "bg-teal-50 border-teal-200" },
};

const isInIframe = () => { try { return window.self !== window.top; } catch { return true; } };

export default function ProgramsEnroll() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [enrollModal, setEnrollModal] = useState(null); // program object
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState(null);
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

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

  const { data: parents = [] } = useQuery({
    queryKey: ["parent-record", user?.email],
    queryFn: () => base44.entities.Parent.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });
  const parent = parents[0];

  const { data: students = [] } = useQuery({
    queryKey: ["parent-students", parent?.student_ids],
    queryFn: async () => {
      if (!parent?.student_ids?.length) return [];
      const all = await Promise.all(parent.student_ids.map(sid => base44.entities.Student.filter({ id: sid })));
      return all.flat();
    },
    enabled: !!parent?.student_ids?.length,
  });

  const PROGRAM_ORDER = [
    { key: "combination", match: (name) => name.startsWith("combination") },
    { key: "hybrid microschool", match: (name) => name.startsWith("hybrid microschool") },
    { key: "virtual homeschool", match: (name) => name.includes("virtual homeschool") },
    { key: "performance training", match: (name) => name.includes("performance training") },
  ];

  // Desired display order (index = priority)
  const DISPLAY_ORDER = [
    (name) => name.startsWith("hybrid microschool"),
    (name) => name.includes("virtual homeschool"),
    (name) => name.includes("performance training"),
    (name) => name.startsWith("combination"),
  ];

  const sortPrograms = (list) => {
    return [...list].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aIdx = DISPLAY_ORDER.findIndex(fn => fn(aName));
      const bIdx = DISPLAY_ORDER.findIndex(fn => fn(bName));
      const ai = aIdx === -1 ? 99 : aIdx;
      const bi = bIdx === -1 ? 99 : bIdx;
      if (ai !== bi) return ai - bi;
      return (a.price_monthly || 0) - (b.price_monthly || 0);
    });
  };

  const programs = programData?.programs || [];
  const myEnrollments = enrollmentData?.enrollments || [];

  const filtered = sortPrograms(
    categoryFilter === "all" ? programs : programs.filter(p => p.category === categoryFilter)
  );

  const getEnrolled = (programId) =>
    myEnrollments.find(e => e.program_id === programId && ["active", "active_override", "pending_payment"].includes(e.status));

  const openModal = (program) => {
    setBillingCycle("monthly");
    setSelectedStudentId(students[0]?.id || null);
    setError(null);
    setPolicyAcknowledged(false);
    setEnrollModal(program);
  };

  const annualSavings = (program) => {
    if (!program.price_annual || !program.price_monthly) return null;
    const annualEquiv = program.price_monthly * 12;
    return annualEquiv - program.price_annual;
  };

  const handleConfirmEnroll = async () => {
    if (isInIframe()) {
      alert("Payment checkout is only available from the published app. Please open the app in a new tab.");
      return;
    }
    setEnrolling(true);
    setError(null);
    const res = await base44.functions.invoke("enrollment", {
      action: "enroll",
      program_id: enrollModal.id,
      student_id: selectedStudentId || undefined,
      billing_cycle: billingCycle,
    });
    setEnrolling(false);

    if (res.data?.error) {
      if (res.data?.enrollment_id) {
        // Already enrolled — send to checkout
        setEnrollModal(null);
        qc.invalidateQueries({ queryKey: ["my-enrollments"] });
        navigate(`/parent/checkout?enrollment_id=${res.data.enrollment_id}`);
      } else {
        setError(res.data.error);
      }
      return;
    }

    if (res.data?.enrollment) {
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      setEnrollModal(null);
      navigate(`/parent/checkout?enrollment_id=${res.data.enrollment.id}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1a3c5e] mb-1">Programs & Enroll</h1>
        <p className="text-slate-500">Browse our programs and enroll your student today.</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setCategoryFilter(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              categoryFilter === tab.key
                ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {programsLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(program => {
            const colors = CATEGORY_COLORS[program.category] || CATEGORY_COLORS.academic;
            const enrolled = getEnrolled(program.id);
            const savings = annualSavings(program);

            return (
              <div key={program.id} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className={`h-1.5 ${colors.bar}`} />
                <div className="p-6">
                  <div className="flex gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={`text-lg font-bold ${colors.title}`}>{program.name}</h3>
                        {enrolled && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                            enrolled.status === "pending_payment" ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-green-50 border-green-200 text-green-700"
                          }`}>
                            {enrolled.status === "pending_payment" ? "⏳ Pending Payment" : "✓ Enrolled"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mb-4">{program.description}</p>
                      {program.features?.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {program.features.map((f, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                              <span className="text-xs text-slate-600">{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right min-w-[140px]">
                      <p className="text-3xl font-bold text-slate-900">${program.price_monthly?.toLocaleString()}</p>
                      <p className="text-xs text-slate-400 mb-1">/month</p>
                      {program.price_annual && (
                        <p className="text-xs text-slate-500 mb-1">or ${program.price_annual?.toLocaleString()} / year</p>
                      )}
                      {savings && savings > 0 && (
                        <p className="text-xs text-green-600 font-semibold mb-3">Save ${savings}/yr annually</p>
                      )}

                      {enrolled ? (
                        enrolled.status === "pending_payment" ? (
                          <Button
                            size="sm"
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white mt-2"
                            onClick={() => navigate(`/parent/checkout?enrollment_id=${enrolled.id}`)}
                          >
                            Complete Payment
                          </Button>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-semibold mt-2">
                            <Check className="w-3.5 h-3.5" /> Currently Enrolled
                          </div>
                        )
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-[#1a3c5e] hover:bg-[#0d2540] text-white mt-2"
                          onClick={() => openModal(program)}
                        >
                          Enroll Now <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">No programs found in this category.</div>
          )}
        </div>
      )}

      {/* Enroll Modal */}
      {enrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#1a3c5e] text-lg">Enroll in {enrollModal.name}</h3>
              <button onClick={() => setEnrollModal(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Multi-student selector */}
            {students.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" /> Enrolling for
                </label>
                <div className="flex gap-2 flex-wrap">
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedStudentId === s.id
                          ? "bg-[#1a3c5e] text-white border-[#1a3c5e]"
                          : "border-slate-200 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {s.full_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Billing toggle */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Billing Cycle</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    billingCycle === "monthly" ? "border-[#1a3c5e] bg-[#1a3c5e] text-white" : "border-slate-200 text-slate-600"
                  }`}
                >
                  Monthly<br />
                  <span className="text-xs font-normal">${enrollModal.price_monthly?.toLocaleString()}/mo</span>
                </button>
                {enrollModal.price_annual && (
                  <button
                    onClick={() => setBillingCycle("annual")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors relative ${
                      billingCycle === "annual" ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Annual
                    {annualSavings(enrollModal) > 0 && (
                      <span className={`block text-xs font-normal ${billingCycle === "annual" ? "text-teal-100" : "text-green-600"}`}>
                        Save ${annualSavings(enrollModal)}/yr
                      </span>
                    )}
                    <span className="block text-xs font-normal">${enrollModal.price_annual?.toLocaleString()} total</span>
                  </button>
                )}
              </div>
            </div>

            {/* Price summary */}
            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">{enrollModal.name}</span>
                <span className="font-semibold">
                  {billingCycle === "annual"
                    ? `$${enrollModal.price_annual?.toLocaleString()}`
                    : `$${enrollModal.price_monthly?.toLocaleString()}/mo`}
                </span>
              </div>
              {billingCycle === "annual" && annualSavings(enrollModal) > 0 && (
                <div className="flex justify-between text-green-600 text-xs">
                  <span>Annual savings</span>
                  <span>–${annualSavings(enrollModal)}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {isInIframe() && (
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-yellow-800 text-xs mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Checkout only works from the published app. Please open in a new tab.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setEnrollModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <Button
                className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]"
                disabled={enrolling || isInIframe()}
                onClick={handleConfirmEnroll}
              >
                {enrolling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : "Confirm & Pay"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}