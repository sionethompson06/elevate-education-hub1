import { Button } from "@/components/ui/button";
import { Loader2, Send, Save } from "lucide-react";

const Row = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span className="text-sm font-medium text-slate-800 text-right max-w-[60%]">{value || <span className="text-slate-300">—</span>}</span>
  </div>
);

export default function StepReview({ form, onBack, onSaveDraft, onSubmit, saving, error }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Review Your Application</h2>
        <p className="text-sm text-slate-500">Please review all information before submitting.</p>
      </div>

      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Parent / Guardian</p>
        <Row label="Name" value={`${form.parent_first_name} ${form.parent_last_name}`} />
        <Row label="Email" value={form.email} />
        <Row label="Phone" value={form.phone} />
      </div>

      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Student</p>
        <Row label="Name" value={`${form.student_first_name} ${form.student_last_name}`} />
        <Row label="Date of Birth" value={form.student_birth_date} />
        <Row label="Age" value={form.student_age} />
        <Row label="Grade" value={form.student_grade} />
      </div>

      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Program</p>
        <Row label="Program Interest" value={form.program_interest} />
        {form.notes && <Row label="Notes" value={form.notes} />}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>← Back</Button>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onSaveDraft} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : <><Send className="w-4 h-4 mr-2" />Submit Application</>}
          </Button>
        </div>
      </div>
    </div>
  );
}