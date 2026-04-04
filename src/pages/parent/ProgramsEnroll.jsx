import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Loader2, AlertCircle, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_COLORS = {
  academic:          { bar: "bg-blue-600",   title: "text-blue-700",   badge: "bg-blue-50 border-blue-200 text-blue-700" },
  virtual_homeschool:{ bar: "bg-purple-600", title: "text-purple-700", badge: "bg-purple-50 border-purple-200 text-purple-700" },
  athletic:          { bar: "bg-red-500",    title: "text-red-700",    badge: "bg-red-50 border-red-200 text-red-700" },
  combined:          { bar: "bg-gradient-to-r from-red-500 to-yellow-400", title: "text-amber-700", badge: "bg-amber-50 border-amber-200 text-amber-700" },
};

const DISPLAY_ORDER = { academic: 0, virtual_homeschool: 1, athletic: 2, combined: 3 };

function FeatureGrid({ features }) {
  if (!features?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
      {features.map((f, i) => (
        <div key={i} className="flex items-start gap-2">
          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          <span className="text-sm text-slate-700">{f}</span>
        </div>
      ))}
    </div>
  );
}

function EnrollButton({ onClick, disabled, loading }) {
  return (
    <Button
      className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 mt-4"
      onClick={onClick}
      disabled={disabled}
    >
      {loading
        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
        : <>Enroll a Student <ChevronRight className="w-4 h-4 ml-1" /></>}
    </Button>
  );
}

function EnrollmentBadge({ enrollment }) {
  if (!enrollment) return null;
  const isPending = enrollment.status === "pending_payment";
  return (
    <div className={`inline-block mt-3 text-xs px-3 py-1 rounded-full border font-medium ${
      isPending ? "bg-yellow-50 border-yellow-300 text-yellow-800" : "bg-green-50 border-green-300 text-green-800"
    }`}>
      {enrollment.program_variant
        ? `${enrollment.program_variant} — ${isPending ? "pending" : "enrolled"}`
        : isPending ? "⏳ Pending Payment" : "✓ Enrolled"}
    </div>
  );
}

// ── Academic card (Hybrid Microschool) ────────────────────────────────────────
function AcademicCard({ program, enrollments, onEnroll }) {
  const colors = CATEGORY_COLORS.academic;
  const enrolled = enrollments.find(e => e.programId === program.id && ["active","active_override","pending_payment"].includes(e.status));
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${colors.bar}`} />
      <div className="p-6 flex gap-6">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-3 ${colors.badge}`}>{program.name}</span>
          <p className="text-sm text-slate-700 leading-relaxed">{program.description}</p>
          <FeatureGrid features={program.features} />
          <EnrollmentBadge enrollment={enrolled} />
        </div>
        <div className="shrink-0 min-w-[140px] text-right">
          <div className="mb-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Monthly</p>
            <p className="text-4xl font-bold text-slate-900">${program.price_monthly?.toLocaleString()}</p>
            <p className="text-xs text-slate-400">/month</p>
          </div>
          {program.price_annual && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">One-time</p>
              <p className="text-3xl font-bold text-slate-900">${program.price_annual?.toLocaleString()}</p>
            </div>
          )}
          <EnrollButton onClick={() => onEnroll(program, null)} />
        </div>
      </div>
    </div>
  );
}

// ── Virtual Homeschool card ───────────────────────────────────────────────────
function VirtualCard({ program, enrollments, onEnroll }) {
  const colors = CATEGORY_COLORS.virtual_homeschool;
  const enrolled1x = enrollments.find(e => e.programId === program.id && e.program_variant === '1x' && ["active","active_override","pending_payment"].includes(e.status));
  const enrolled2x = enrollments.find(e => e.programId === program.id && e.program_variant === '2x' && ["active","active_override","pending_payment"].includes(e.status));
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${colors.bar}`} />
      <div className="p-6 flex gap-6">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-3 ${colors.badge}`}>{program.name}</span>
          <p className="text-sm text-slate-700 leading-relaxed">{program.description}</p>
          <FeatureGrid features={program.features} />
          {(enrolled1x || enrolled2x) && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <EnrollmentBadge enrollment={enrolled1x ? { ...enrolled1x, program_variant: '1 Session / Week' } : null} />
              <EnrollmentBadge enrollment={enrolled2x ? { ...enrolled2x, program_variant: '2 Sessions / Week' } : null} />
            </div>
          )}
        </div>
        <div className="shrink-0 min-w-[140px] text-right space-y-4">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">1 Session / Week</p>
            <p className="text-4xl font-bold text-slate-900">${program.price_monthly?.toLocaleString()}</p>
            <p className="text-xs text-slate-400">/month</p>
          </div>
          {program.price_2x && (
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">2 Sessions / Week</p>
              <p className="text-4xl font-bold text-slate-900">${program.price_2x?.toLocaleString()}</p>
              <p className="text-xs text-slate-400">/month</p>
            </div>
          )}
          <EnrollButton onClick={() => onEnroll(program, null)} />
        </div>
      </div>
    </div>
  );
}

// ── Athletic / Performance card ───────────────────────────────────────────────
function AthleticCard({ program, enrollments, onEnroll }) {
  const colors = CATEGORY_COLORS.athletic;
  const enrolled = enrollments.find(e => e.programId === program.id && ["active","active_override","pending_payment"].includes(e.status));
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${colors.bar}`} />
      <div className="p-6 flex gap-6">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-3 ${colors.badge}`}>{program.name}</span>
          <p className="text-sm text-slate-700 leading-relaxed">{program.description}</p>
          <FeatureGrid features={program.features} />
          <EnrollmentBadge enrollment={enrolled} />
        </div>
        <div className="shrink-0 min-w-[140px] text-right">
          <div className="mb-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Monthly</p>
            <p className="text-4xl font-bold text-slate-900">${program.price_monthly?.toLocaleString()}</p>
            <p className="text-xs text-slate-400">/month</p>
          </div>
          {program.price_annual && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">One-time</p>
              <p className="text-3xl font-bold text-slate-900">${program.price_annual?.toLocaleString()}</p>
            </div>
          )}
          <EnrollButton onClick={() => onEnroll(program, null)} />
        </div>
      </div>
    </div>
  );
}

// ── Combination card ──────────────────────────────────────────────────────────
function CombinationCard({ program, enrollments, onEnroll }) {
  const colors = CATEGORY_COLORS.combined;
  const variants = program.variants || [];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${colors.bar}`} />
      <div className="p-6 flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${colors.badge}`}>{program.name}</span>
            {program.badge && (
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-amber-400 text-amber-900 border border-amber-500">{program.badge}</span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{program.description}</p>
          <FeatureGrid features={program.features} />
        </div>
        <div className="shrink-0 min-w-[200px] space-y-3">
          {variants.map((v, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 text-right border border-slate-200">
              <p className="text-xs text-slate-500 font-medium mb-1">{v.name}</p>
              <p className="text-2xl font-bold text-slate-900">${v.price_monthly?.toLocaleString()}<span className="text-xs font-normal text-slate-400">/mo</span></p>
              {v.price_annual && (
                <p className="text-xs text-slate-400">or ${v.price_annual?.toLocaleString()} one-time</p>
              )}
            </div>
          ))}
          <EnrollButton onClick={() => onEnroll(program, null)} />
        </div>
      </div>
    </div>
  );
}

// ── Enrollment Modal ──────────────────────────────────────────────────────────
function EnrollModal({ program, students, onClose, onConfirm, enrolling, error }) {
  const isVirtual = program.category === 'virtual_homeschool';
  const isCombined = program.category === 'combined';
  const variants = program.variants || [];

  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedVariant, setSelectedVariant] = useState(variants[0]?.name || null);
  const [policyAck, setPolicyAck] = useState(false);

  const getPrice = () => {
    if (isCombined) {
      const v = variants.find(x => x.name === selectedVariant);
      return billingCycle === 'annual' && v?.price_annual
        ? `$${v.price_annual.toLocaleString()} one-time`
        : `$${v?.price_monthly?.toLocaleString()}/mo`;
    }
    if (isVirtual) {
      const p = selectedVariant === '2x' ? program.price_2x : program.price_monthly;
      return `$${p?.toLocaleString()}/mo`;
    }
    return billingCycle === 'annual' && program.price_annual
      ? `$${program.price_annual.toLocaleString()} one-time`
      : `$${program.price_monthly?.toLocaleString()}/mo`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#1a3c5e] text-lg">Enroll in {program.name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Variant selector for virtual */}
        {isVirtual && program.price_2x && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Session Frequency</label>
            <div className="flex gap-2">
              {[['1x', `1 Session / Week — $${program.price_monthly}/mo`], ['2x', `2 Sessions / Week — $${program.price_2x}/mo`]].map(([key, label]) => (
                <button key={key} onClick={() => setSelectedVariant(key)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-colors text-left ${selectedVariant === key ? 'border-[#1a3c5e] bg-[#1a3c5e] text-white' : 'border-slate-200 text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Variant selector for combination */}
        {isCombined && variants.length > 0 && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Program Combination</label>
            <div className="space-y-2">
              {variants.map(v => (
                <button key={v.name} onClick={() => setSelectedVariant(v.name)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${selectedVariant === v.name ? 'border-[#1a3c5e] bg-[#1a3c5e]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="text-sm font-medium text-slate-800">{v.name}</span>
                  <span className="text-sm font-bold text-slate-900">${v.price_monthly}/mo</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Billing cycle for programs with annual option */}
        {!isVirtual && !isCombined && program.price_annual && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Billing Cycle</label>
            <div className="flex gap-2">
              {[['monthly', `Monthly — $${program.price_monthly}/mo`], ['annual', `One-time — $${program.price_annual}`]].map(([key, label]) => (
                <button key={key} onClick={() => setBillingCycle(key)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors ${billingCycle === key ? 'border-[#1a3c5e] bg-[#1a3c5e] text-white' : 'border-slate-200 text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Student selector */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Enrolling for
          </label>
          {students.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No students found on your account.</p>
          ) : (
            <div className="space-y-2">
              {students.map(s => (
                <button key={s.id} onClick={() => setSelectedStudentId(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${selectedStudentId === s.id ? 'border-[#1a3c5e] bg-[#1a3c5e]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${selectedStudentId === s.id ? 'bg-[#1a3c5e] text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {(s.firstName || s.full_name || '?').charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{s.firstName ? `${s.firstName} ${s.lastName}` : s.full_name}</p>
                    {s.grade && <p className="text-xs text-slate-400">Grade {s.grade}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price summary */}
        <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm flex justify-between">
          <span className="text-slate-600">{isCombined ? (selectedVariant || program.name) : isVirtual ? `${selectedVariant === '2x' ? '2 Sessions / Week' : '1 Session / Week'}` : program.name}</span>
          <span className="font-semibold">{getPrice()}</span>
        </div>

        {/* Policy */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Enrollment & Cancellation Policy</p>
          <div className="border border-slate-200 rounded-xl p-3 h-32 overflow-y-auto text-xs text-slate-600 leading-relaxed bg-slate-50 space-y-2">
            <p><strong>Monthly Billing</strong> — Tuition is charged in advance each month. Payments are processed automatically.</p>
            <p><strong>30-Day Written Cancellation Notice</strong> — To cancel, a 30-day written notice is required via email. The notice period begins on the date the request is received. Tuition for the current cycle and any services within the notice period remain your responsibility.</p>
            <p><strong>Non-Attendance</strong> — Discontinuing participation without written notice does not constitute cancellation. Charges continue until the 30-day requirement is fulfilled.</p>
            <p><strong>Agreement</strong> — By enrolling you acknowledge and agree to this policy.</p>
          </div>
          <label className="flex items-start gap-2 mt-3 cursor-pointer">
            <input type="checkbox" checked={policyAck} onChange={e => setPolicyAck(e.target.checked)} className="mt-0.5 accent-[#1a3c5e]" />
            <span className="text-xs text-slate-700">I have read and agree to the Enrollment & Cancellation Policy.</span>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <Button
            className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]"
            disabled={enrolling || !policyAck || !selectedStudentId}
            onClick={() => onConfirm({ studentId: selectedStudentId, billingCycle, variant: selectedVariant })}
          >
            {enrolling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : 'Confirm & Pay'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProgramsEnroll() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [enrollModal, setEnrollModal] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState(null);

  const { data: programData, isLoading } = useQuery({
    queryKey: ['parent-programs'],
    queryFn: () => base44.functions.invoke('enrollment', { action: 'get_programs' }).then(r => r.data),
    enabled: !!user,
  });

  const { data: enrollmentData } = useQuery({
    queryKey: ['my-enrollments', user?.id],
    queryFn: () => base44.functions.invoke('enrollment', { action: 'get_my_enrollments' }).then(r => r.data),
    enabled: !!user,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['my-students', user?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('enrollment', { action: 'get_my_enrollments' });
      return res.data?.students || [];
    },
    enabled: !!user,
  });

  const programs = (programData?.programs || []).sort((a, b) => (DISPLAY_ORDER[a.category] ?? 99) - (DISPLAY_ORDER[b.category] ?? 99));
  const myEnrollments = (enrollmentData?.enrollments || []).map(e => ({ ...e, programId: e.programId ?? e.program_id }));

  const handleEnroll = async ({ studentId, billingCycle, variant }) => {
    setEnrolling(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('enrollment', {
        action: 'enroll',
        program_id: enrollModal.id,
        student_id: studentId,
        billing_cycle: billingCycle,
        variant,
      });
      qc.invalidateQueries({ queryKey: ['my-enrollments'] });
      setEnrollModal(null);
      if (res.data?.enrollment) {
        navigate(`/parent/checkout?enrollment_id=${res.data.enrollment.id}`);
      }
    } catch (err) {
      setError(err.message || 'Enrollment failed. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const cardProps = (program) => ({
    program,
    enrollments: myEnrollments,
    onEnroll: (p) => { setError(null); setEnrollModal(p); },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-1">Programs</h1>
        <p className="text-slate-500 text-lg">Explore and enroll your students in our programs</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
        </div>
      ) : programs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No programs available at this time.</div>
      ) : (
        <div className="space-y-5">
          {programs.map(program => {
            if (program.category === 'academic') return <AcademicCard key={program.id} {...cardProps(program)} />;
            if (program.category === 'virtual_homeschool') return <VirtualCard key={program.id} {...cardProps(program)} />;
            if (program.category === 'athletic') return <AthleticCard key={program.id} {...cardProps(program)} />;
            if (program.category === 'combined') return <CombinationCard key={program.id} {...cardProps(program)} />;
            return null;
          })}
        </div>
      )}

      {enrollModal && (
        <EnrollModal
          program={enrollModal}
          students={students}
          onClose={() => setEnrollModal(null)}
          onConfirm={handleEnroll}
          enrolling={enrolling}
          error={error}
        />
      )}
    </div>
  );
}
