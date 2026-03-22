import { Button } from "@/components/ui/button";
import FormField from "./FormField";

export default function StepParent({ form, update, onNext }) {
  const valid = form.parent_first_name && form.parent_last_name && form.email && form.phone;

  const handleNext = (e) => {
    e.preventDefault();
    if (valid) onNext();
  };

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Parent / Guardian Information</h2>
      <p className="text-sm text-slate-500 mb-4">Tell us about the parent or guardian applying on behalf of the student.</p>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="First Name" required value={form.parent_first_name} onChange={(v) => update({ parent_first_name: v })} />
        <FormField label="Last Name" required value={form.parent_last_name} onChange={(v) => update({ parent_last_name: v })} />
      </div>
      <FormField label="Email Address" type="email" required value={form.email} onChange={(v) => update({ email: v })} />
      <FormField label="Phone Number" type="tel" required value={form.phone} onChange={(v) => update({ phone: v })} placeholder="(555) 000-0000" />

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={!valid} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
          Next: Student Info →
        </Button>
      </div>
    </form>
  );
}