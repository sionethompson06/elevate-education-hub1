import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
const isInIframe = () => { try { return window.self !== window.top; } catch { return true; } };
import BillingCycleSelector from "@/components/parent/BillingCycleSelector";
import TuitionSummary from "@/components/parent/TuitionSummary";
import TermsCheckbox from "@/components/parent/TermsCheckbox";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function Checkout() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const enrollmentId = searchParams.get("enrollment_id");
  const navigate = useNavigate();

  const [billingCycle, setBillingCycle] = useState("monthly");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ["enrollment", enrollmentId],
    queryFn: () => base44.entities.Enrollment.filter({ id: enrollmentId }).then((r) => r[0]),
    enabled: !!enrollmentId,
  });

  const handleCheckout = async () => {
    if (isInIframe()) {
      alert("Payment checkout is only available from the published app. Please open the app in a new tab.");
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
      <p className="text-slate-500">No enrollment selected. <Link to="/parent/dashboard" className="text-[#1a3c5e] underline">Go back</Link></p>
    </div>
  );

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/parent/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1a3c5e] mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-[#1a3c5e] mb-6">Complete Your Enrollment</h1>

        <div className="space-y-5">
          {/* Program info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Program</p>
            <p className="text-lg font-semibold text-slate-800">{enrollment?.program_name}</p>
          </div>

          {/* Billing cycle */}
          <BillingCycleSelector
            value={billingCycle}
            onChange={setBillingCycle}
            programName={enrollment?.program_name}
          />

          {/* Tuition summary */}
          <TuitionSummary billingCycle={billingCycle} programName={enrollment?.program_name} />

          {/* Terms */}
          <TermsCheckbox accepted={termsAccepted} onChange={setTermsAccepted} />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <Button
            className="w-full bg-[#1a3c5e] hover:bg-[#0d2540] h-12 text-base"
            disabled={!termsAccepted || loading}
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