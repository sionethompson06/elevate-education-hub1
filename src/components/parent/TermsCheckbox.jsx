import { Link } from "react-router-dom";

export default function TermsCheckbox({ accepted, onChange }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Policy Acknowledgment</p>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-4 h-4 accent-[#1a3c5e]"
        />
        <span className="text-sm text-slate-600 leading-relaxed">
          I have read and agree to the{" "}
          <Link to="/cancellation-policy" target="_blank" className="text-[#1a3c5e] underline">
            Cancellation Policy
          </Link>{" "}
          and{" "}
          <Link to="/cancellation-policy" target="_blank" className="text-[#1a3c5e] underline">
            Terms of Enrollment
          </Link>
          . I understand that tuition is due as scheduled and cancellations must be submitted in writing per policy.
        </span>
      </label>
    </div>
  );
}