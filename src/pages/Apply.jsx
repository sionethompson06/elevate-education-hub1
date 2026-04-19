import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import StepIndicator from "@/components/apply/StepIndicator";
import StepParent from "@/components/apply/StepParent";
import StepStudent from "@/components/apply/StepStudent";
import StepProgram from "@/components/apply/StepProgram";
import StepReview from "@/components/apply/StepReview";
import ConfirmationPage from "@/components/apply/ConfirmationPage";
import PublicNav from "@/components/layout/PublicNav";
import PublicFooter from "@/components/layout/PublicFooter";

const STEPS = ["Parent Info", "Student Info", "Program", "Review"];

const EMPTY_FORM = {
  parent_first_name: "",
  parent_last_name: "",
  email: "",
  phone: "",
  student_first_name: "",
  student_last_name: "",
  student_birth_date: "",
  student_age: "",
  student_grade: "",
  program_interest: "",
  notes: "",
};

export default function Apply() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    email: user?.email || "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submittedApp, setSubmittedApp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (fields) => setForm((f) => ({ ...f, ...fields }));

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/applications", {
        ...form,
        student_age: Number(form.student_age) || 0,
        status: "draft",
      });
      alert("Draft saved! You can return to complete your application later.");
    } catch (err) {
      setError(err.message || "Could not save draft. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiPost("/applications", {
        ...form,
        student_age: Number(form.student_age) || 0,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      setSubmittedApp(res.application);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (submitted) return <ConfirmationPage application={submittedApp} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicNav />
      <main className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#1a3c5e]">Apply to Elevate</h1>
            <p className="text-slate-500 mt-2">Complete the form below to begin your enrollment journey.</p>
          </div>

          <StepIndicator steps={STEPS} current={step} />

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 mt-6">
            {step === 0 && <StepParent form={form} update={update} onNext={() => setStep(1)} />}
            {step === 1 && <StepStudent form={form} update={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
            {step === 2 && <StepProgram form={form} update={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && (
              <StepReview
                form={form}
                onBack={() => setStep(2)}
                onSaveDraft={handleSaveDraft}
                onSubmit={handleSubmit}
                saving={saving}
                error={error}
              />
            )}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}