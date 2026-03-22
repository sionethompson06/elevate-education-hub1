import { CheckCircle, X } from "lucide-react";
import { useState } from "react";

export default function PaymentSuccessBanner({ enrollmentId }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-4">
      <CheckCircle className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-green-800">Payment Successful!</p>
        <p className="text-sm text-green-700 mt-0.5">
          Your enrollment is now active. You'll receive a receipt at your email address.
          Your student's portal access has been enabled.
        </p>
      </div>
      <button onClick={() => setDismissed(true)} className="text-green-500 hover:text-green-700">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}