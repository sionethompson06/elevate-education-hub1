import { Button } from "@/components/ui/button";
import FormField from "./FormField";

const GRADES = ["Pre-K", "Kindergarten", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

export default function StepStudent({ form, update, onNext, onBack }) {
  const valid = form.student_first_name && form.student_last_name && form.student_birth_date && form.student_grade;

  const handleNext = (e) => {
    e.preventDefault();
    if (valid) onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Student Information</h2>
      <p className="text-sm text-slate-500 mb-4">Tell us about the student who will be enrolling.</p>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="First Name" required value={form.student_first_name} onChange={(v) => update({ student_first_name: v })} />
        <FormField label="Last Name" required value={form.student_last_name} onChange={(v) => update({ student_last_name: v })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date of Birth" type="date" required value={form.student_birth_date} onChange={(v) => update({ student_birth_date: v })} />
        <FormField label="Age" type="number" value={form.student_age} onChange={(v) => update({ student_age: v })} placeholder="e.g. 14" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Current Grade <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
          value={form.student_grade}
          onChange={(e) => update({ student_grade: e.target.value })}
          required
        >
          <option value="">Select grade…</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>← Back</Button>
        <Button type="submit" disabled={!valid} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
          Next: Program →
        </Button>
      </div>
    </form>
  );
}