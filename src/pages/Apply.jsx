import { Link } from "react-router-dom";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Apply() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-[#1a3c5e] text-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <GraduationCap className="w-6 h-6" />
          Elevate Education Hub
        </Link>
      </nav>
      <div className="max-w-2xl mx-auto py-16 px-6 text-center">
        <h1 className="text-3xl font-bold text-[#1a3c5e] mb-4">Apply to Elevate</h1>
        <p className="text-slate-500 mb-8">
          The full multi-step application form will be built in Phase 4 (Admissions Workflow).
        </p>
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <p className="text-slate-400">Application form coming in Phase 4.</p>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 mt-6 text-[#1a3c5e] hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}