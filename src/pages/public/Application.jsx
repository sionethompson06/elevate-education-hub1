import { Link } from "react-router-dom";
import { GraduationCap, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Application() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16 px-6 bg-slate-50">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-[#1a3c5e]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <GraduationCap className="w-8 h-8 text-[#1a3c5e]" />
        </div>
        <h1 className="text-3xl font-bold text-[#1a3c5e] mb-3">Apply to Elevate</h1>
        <div className="flex items-center justify-center gap-2 text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Multi-step application form launches in Phase 4 (Admissions Workflow)</span>
        </div>
        <p className="text-slate-500 mb-8">
          In the meantime, reach out to our admissions team directly — we'd love to hear from you.
        </p>
        <div className="flex flex-col gap-3">
          <a href="mailto:admissions@elevateperformanceacademy.com">
            <Button className="w-full bg-[#1a3c5e] hover:bg-[#0d2540]">
              Email Admissions
            </Button>
          </a>
          <Link to="/contact">
            <Button variant="outline" className="w-full">Contact Us</Button>
          </Link>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 mt-6 text-slate-400 hover:text-slate-600 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}