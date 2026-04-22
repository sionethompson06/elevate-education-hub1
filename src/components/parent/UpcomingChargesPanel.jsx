import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Compute the next charge date given an enrollment's start date and billing cycle.
// For monthly: next occurrence of the start day in coming months.
// For annual: next occurrence of the start month+day in coming years.
function nextChargeDate(startDate, cycle) {
  if (!startDate || !cycle) return null;
  const start = new Date(startDate + "T00:00:00");
  if (isNaN(start.getTime())) return null;
  const now = new Date();

  if (cycle === "monthly") {
    const next = new Date(now.getFullYear(), now.getMonth(), start.getDate());
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next;
  }
  if (cycle === "annual") {
    const next = new Date(now.getFullYear(), start.getMonth(), start.getDate());
    if (next <= now) next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  return null;
}

// Build upcoming charges for the next 3 months from active monthly/annual enrollments.
function buildUpcomingCharges(enrollments) {
  const charges = [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + 3);

  for (const e of enrollments) {
    if (!["active", "active_override"].includes(e.status)) continue;
    const cycle = e.billingCycleOverride || e.programBillingCycle;
    if (!cycle || cycle === "one_time") continue;

    const amount = e.invoiceAmount != null
      ? parseFloat(e.invoiceAmount)
      : parseFloat(e.programTuition) || 0;
    if (!amount) continue;

    const studentName = e.studentFirstName
      ? `${e.studentFirstName} ${e.studentLastName || ""}`.trim()
      : null;

    if (cycle === "monthly") {
      // Show next 3 months of charges
      const start = new Date();
      const startDay = e.startDate
        ? new Date(e.startDate + "T00:00:00").getDate()
        : new Date().getDate();
      for (let m = 0; m < 3; m++) {
        const d = new Date(start.getFullYear(), start.getMonth() + m, startDay);
        if (d > new Date() && d <= cutoff) {
          charges.push({ date: d, programName: e.programName, studentName, amount, cycle });
        }
      }
    } else if (cycle === "annual") {
      const next = nextChargeDate(e.startDate, "annual");
      if (next && next <= cutoff) {
        charges.push({ date: next, programName: e.programName, studentName, amount, cycle });
      }
    }
  }

  return charges.sort((a, b) => a.date - b.date);
}

export default function UpcomingChargesPanel({ enrollments = [] }) {
  const charges = buildUpcomingCharges(enrollments);

  const monthlyTotal = enrollments
    .filter(e => ["active", "active_override"].includes(e.status) && (e.billingCycleOverride || e.programBillingCycle) === "monthly")
    .reduce((sum, e) => sum + (e.invoiceAmount != null ? parseFloat(e.invoiceAmount) : parseFloat(e.programTuition) || 0), 0);

  if (charges.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-700 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-400" />
          Upcoming Charges
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {charges.map((c, i) => {
            const dateStr = c.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return (
              <div key={i} className="flex items-center justify-between px-6 py-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.programName || "Program"}</p>
                  <p className="text-xs text-slate-400">
                    {c.studentName ? `${c.studentName} · ` : ""}
                    <span className="capitalize">{c.cycle.replace(/_/g, " ")}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-700">
                    ${c.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400">{dateStr}</p>
                </div>
              </div>
            );
          })}
        </div>
        {monthlyTotal > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t">
            <p className="text-xs font-semibold text-slate-500">Est. monthly total</p>
            <p className="text-sm font-bold text-[#1a3c5e]">
              ${monthlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
