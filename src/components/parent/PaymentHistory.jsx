import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_CONFIG = {
  succeeded: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Paid" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Failed" },
  pending: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50", label: "Pending" },
  refunded: { icon: XCircle, color: "text-slate-500", bg: "bg-slate-50", label: "Refunded" },
};

export default function PaymentHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke("getPaymentHistory")
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
    </div>
  );

  const payments = data?.payments || [];

  if (!payments.length) return (
    <Card>
      <CardHeader><CardTitle className="text-base text-slate-700">Payment History</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-slate-400">No payments recorded yet.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base text-slate-700">Payment History</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {payments.map((p) => {
            const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
            const Icon = sc.icon;
            return (
              <div key={p.id} className="flex items-center justify-between px-6 py-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${sc.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${sc.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.description || "Payment"}</p>
                    <p className="text-xs text-slate-400">
                      {p.paid_at ? format(new Date(p.paid_at), "MMM d, yyyy") : "—"} · {p.payment_method?.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-slate-800">
                    ${(p.amount || 0).toLocaleString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>
                    {sc.label}
                  </span>
                  {p.stripe_invoice_id && (
                    <a
                      href={`https://dashboard.stripe.com/test/invoices/${p.stripe_invoice_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-[#1a3c5e]"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}