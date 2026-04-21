import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { apiGet } from "@/api/apiClient";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_CONFIG = {
  paid:     { icon: CheckCircle, color: "text-green-600",  bg: "bg-green-50",  label: "Paid" },
  pending:  { icon: Clock,       color: "text-yellow-500", bg: "bg-yellow-50", label: "Pending" },
  past_due: { icon: XCircle,     color: "text-red-600",    bg: "bg-red-50",    label: "Past Due" },
  waived:   { icon: CheckCircle, color: "text-slate-500",  bg: "bg-slate-50",  label: "Waived" },
  failed:   { icon: XCircle,     color: "text-red-500",    bg: "bg-red-50",    label: "Failed" },
  refunded: { icon: XCircle,     color: "text-slate-500",  bg: "bg-slate-50",  label: "Refunded" },
};

export default function PaymentHistory() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["parent-invoices", user?.id],
    queryFn: () => apiGet("/billing/invoices"),
    enabled: !!user?.id,
  });

  if (isLoading) return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
    </div>
  );

  const invoiceList = data?.invoices || [];

  if (!invoiceList.length) return (
    <Card>
      <CardHeader><CardTitle className="text-base text-slate-700">Payment History</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-slate-400">No invoices on record yet.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base text-slate-700">Payment History</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {invoiceList.map((inv) => {
            const sc = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
            const Icon = sc.icon;
            const label = inv.programName
              ? `${inv.description || inv.programName}${inv.studentFirstName ? ` — ${inv.studentFirstName} ${inv.studentLastName || ""}` : ""}`
              : (inv.description || "Invoice");
            const dateStr = inv.paidDate || inv.dueDate || inv.createdAt;
            return (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${sc.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${sc.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">
                      {dateStr ? format(new Date(dateStr), "MMM d, yyyy") : "—"}
                      {inv.paidDate ? " · Paid" : inv.dueDate ? ` · Due ${format(new Date(inv.dueDate), "MMM d")}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-slate-800">
                    ${parseFloat(inv.amount || 0).toLocaleString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>
                    {sc.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
