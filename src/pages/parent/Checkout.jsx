import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Lock, CheckCircle, AlertCircle, CreditCard } from "lucide-react";
import BillingCycleSelector from "@/components/parent/BillingCycleSelector";
import TuitionSummary from "@/components/parent/TuitionSummary";
import TermsCheckbox from "@/components/parent/TermsCheckbox";

const isInIframe = () => { try { return window.self !== window.top; } catch { return true; } };

export default function Checkout() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const enrollmentId = searchParams.get("enrollment_id");
  const navigate = useNavigate();

  const [billingCycle, setBillingCycle] = useState("monthly");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["enrollment-detail", enrollmentId],
    queryFn: () => base44.entities.Enrollment.filter({ id: enrollmentId }).then(r => r[0]),
    enabled: !!enrollmentId,
  });

  // Validate parent owns this enrollment
  const { data: parents = [] } = useQuery({
    queryKey: ["parent-record", user?.email],
    queryFn: () => base44.entities.Parent.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });
  const parent = parents[0];
  const ownsEnrollment = !enrollment || !parent || parent.student_ids?.includes(enrollment.student_id);

  const handleCheckout = async () => {
    if (isInIframe()) {
      alert("Payment checkout is only available from the published app. Please open the app in a new tab.");
      return;
    }
    if (!ownsEnrollment) {
      setError("You do not have permission to pay for this enrollment.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke("stripeCheckout", {
      enrollment_id: enrollmentId,
      billing_cycle: billingCycle,
      success_url: `${window.location.origin}/parent/dashboard?payment=success&enrollment=${enrollmentId}`,
      cancel_url: `${window.location.origin}/parent/checkout?enrollment_id=${enrollmentId}`,
    });
    if (res.data?.url) {
      window.location.href = res.data.url;
    } else {
      setError(res.data?.error || "Failed to create checkout session.");
      setLoading(false);
    }
  };

  if (!enrollmentId) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500 mb-3">No enrollment selected.</p>
        <Link to="/parent/programs" className="text-[#1a3c5e] underline text-sm">Browse Programs →</Link>
      </div>
    </div>
  );

  if (enrollmentLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
    </div>
  );

  if (!enrollment) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600">Enrollment not found.</p>
        <Link to="/parent/programs" className="text-[#1a3c5e] underline text-sm mt-2 block">Back to Programs</Link>
      </div>
    </div>
  );

  if (enrollment.status === "active" || enrollment.status === "active_override") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800 mb-1">Already Active!</h2>
        <p className="text-slate-500 text-sm mb-4">This enrollment is already active and paid.</p>
        <Link to="/parent/dashboard">
          <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );

  if (!ownsEnrollment) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600 font-semibold">Access Denied</p>
        <p className="text-slate-400 text-sm">This enrollment doesn't belong to your account.</p>
        <Link to="/parent/dashboard" className="text-[#1a3c5e] underline text-sm mt-2 block">Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/parent/programs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1a3c5e] mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Programs
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#1a3c5e] rounded-xl flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a3c5e]">Complete Enrollment</h1>
            <p className="text-sm text-slate-400">Secure checkout via Stripe</p>
          </div>
        </div>

        {/* Iframe warning */}
        {isInIframe() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 mb-5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Payment checkout requires the published app. Please open this page in a new browser tab to complete payment.
          </div>
        )}

        <div className="space-y-5">
          {/* Program info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Program</p>
            <p className="text-lg font-bold text-slate-800">{enrollment.program_name}</p>
            <div className="flex gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${enrollment.status === "payment_failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                {enrollment.status === "payment_failed" ? "Payment Failed — Retry" : "Pending Payment"}
              </span>
            </div>
          </div>

          {/* Billing cycle */}
          <BillingCycleSelector
            value={billingCycle}
            onChange={(cycle) => { setBillingCycle(cycle); setError(null); }}
            programName={enrollment.program_name}
          />

          {/* Order summary */}
          <TuitionSummary billingCycle={billingCycle} programName={enrollment.program_name} />

          {/* Terms */}
          <TermsCheckbox accepted={termsAccepted} onChange={setTermsAccepted} />

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <Button
            className="w-full bg-[#1a3c5e] hover:bg-[#0d2540] h-12 text-base"
            disabled={!termsAccepted || loading || isInIframe()}
            onClick={handleCheckout}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting to Stripe…</>
            ) : (
              <><Lock className="w-4 h-4 mr-2" />Continue to Secure Payment</>
            )}
          </Button>

          <p className="text-center text-xs text-slate-400">
            Payments are securely processed by Stripe. We never store your card details.
          </p>
        </div>
      </div>
    </div>
  );
}