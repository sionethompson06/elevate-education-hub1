import { useState } from "react";
import { apiPost } from "@/api/apiClient";
import { X, Loader2, CheckCircle2, UserPlus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const GRADES = ["Pre-K", "Kindergarten", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const PROGRAMS = [
  "Hybrid Microschool",
  "Performance Training",
  "Virtual School 1-Day",
  "Virtual School 2-Days",
];
const COMPETITION_LEVELS = ["Recreational", "Club", "Travel", "Elite / Select", "Varsity"];

const EMPTY_STUDENT = {
  student_first_name: "",
  student_last_name: "",
  student_birth_date: "",
  student_age: "",
  student_grade: "",
  program_interest: "",
  sports_played: "",
  competition_level: "",
  referral_source: "",
  essay: "",
};

const EMPTY_PARENT = {
  parent_first_name: "",
  parent_last_name: "",
  email: "",
  phone: "",
};

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30";
const selectCls = `${inputCls} bg-white`;

export default function CreateApplicationModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const [parent, setParent] = useState(EMPTY_PARENT);
  const [student, setStudent] = useState(EMPTY_STUDENT);
  const [submitAs, setSubmitAs] = useState("submitted");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // holds the newly created application

  const setP = (field) => (e) => setParent(p => ({ ...p, [field]: e.target.value }));
  const setS = (field) => (e) => setStudent(s => ({ ...s, [field]: e.target.value }));

  // Auto-calculate age from DOB
  const handleDob = (e) => {
    const dob = e.target.value;
    setStudent(s => ({ ...s, student_birth_date: dob }));
    if (dob) {
      const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
      if (age >= 0 && age <= 25) setStudent(s => ({ ...s, student_birth_date: dob, student_age: String(age) }));
    }
  };

  const canSave = parent.parent_first_name.trim() && parent.parent_last_name.trim() &&
    parent.email.trim() && student.student_first_name.trim() && student.student_last_name.trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await apiPost("/applications", {
        ...parent,
        ...student,
        status: submitAs,
      });
      const newApp = result.application;
      setCreated(newApp);
      toast({ title: submitAs === "submitted" ? "Application submitted" : "Draft saved" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenApplication = () => {
    onCreated(created);
    onClose();
  };

  const handleAddAnother = () => {
    // Keep parent info, clear only student + program fields
    setStudent(EMPTY_STUDENT);
    setCreated(null);
    setSubmitAs("submitted");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h3 className="font-bold text-[#1a3c5e] text-lg">New Application</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Success state */}
        {created ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">
                {submitAs === "submitted" ? "Application Submitted" : "Draft Saved"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {student.student_first_name} {student.student_last_name} —{" "}
                {parent.parent_first_name} {parent.parent_last_name} family
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <Button
                onClick={handleOpenApplication}
                className="bg-[#1a3c5e] hover:bg-[#0d2540] gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Open Application
              </Button>
              <Button
                variant="outline"
                onClick={handleAddAnother}
                className="gap-2 border-[#1a3c5e] text-[#1a3c5e] hover:bg-[#1a3c5e]/5"
              >
                <UserPlus className="w-4 h-4" /> Add Another Student for This Family
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Parent info ({parent.email}) is pre-filled for the next student.
            </p>
          </div>
        ) : (
          <>
            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Parent / Guardian */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Parent / Guardian
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" required>
                    <input className={inputCls} value={parent.parent_first_name} onChange={setP("parent_first_name")} placeholder="Jane" />
                  </Field>
                  <Field label="Last Name" required>
                    <input className={inputCls} value={parent.parent_last_name} onChange={setP("parent_last_name")} placeholder="Smith" />
                  </Field>
                  <Field label="Email" required>
                    <input type="email" className={inputCls} value={parent.email} onChange={setP("email")} placeholder="jane@email.com" />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" className={inputCls} value={parent.phone} onChange={setP("phone")} placeholder="(808) 000-0000" />
                  </Field>
                </div>
              </div>

              {/* Student */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Student
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" required>
                    <input className={inputCls} value={student.student_first_name} onChange={setS("student_first_name")} placeholder="Alex" />
                  </Field>
                  <Field label="Last Name" required>
                    <input className={inputCls} value={student.student_last_name} onChange={setS("student_last_name")} placeholder="Smith" />
                  </Field>
                  <Field label="Date of Birth">
                    <input type="date" className={inputCls} value={student.student_birth_date} onChange={handleDob} />
                  </Field>
                  <Field label="Age">
                    <input type="number" min="3" max="25" className={inputCls} value={student.student_age} onChange={setS("student_age")} placeholder="Auto-calculated from DOB" />
                  </Field>
                  <Field label="Grade" >
                    <select className={selectCls} value={student.student_grade} onChange={setS("student_grade")}>
                      <option value="">Select grade…</option>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Program & Background */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Program &amp; Background
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Program Interest">
                    <select className={selectCls} value={student.program_interest} onChange={setS("program_interest")}>
                      <option value="">Select program…</option>
                      {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Competition Level">
                    <select className={selectCls} value={student.competition_level} onChange={setS("competition_level")}>
                      <option value="">Select level…</option>
                      {COMPETITION_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Sports Played">
                    <input className={inputCls} value={student.sports_played} onChange={setS("sports_played")} placeholder="e.g. Basketball, Track" />
                  </Field>
                  <Field label="How did they hear about us?">
                    <input className={inputCls} value={student.referral_source} onChange={setS("referral_source")} placeholder="e.g. Instagram, referral…" />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Notes">
                      <textarea
                        className={`${inputCls} min-h-[72px] resize-none`}
                        value={student.essay}
                        onChange={setS("essay")}
                        placeholder="Any additional context about this student or family…"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 shrink-0 flex items-center justify-between gap-4 flex-wrap">
              {/* Draft / Submit toggle */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {[
                  { value: "submitted", label: "Submit Application" },
                  { value: "draft", label: "Save as Draft" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setSubmitAs(value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      submitAs === value
                        ? "bg-white text-[#1a3c5e] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className="bg-[#1a3c5e] hover:bg-[#0d2540] min-w-[120px]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {submitAs === "submitted" ? "Submit Application" : "Save Draft"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
