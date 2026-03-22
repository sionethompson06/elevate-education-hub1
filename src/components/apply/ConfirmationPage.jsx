import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicNav from "@/components/layout/PublicNav";
import PublicFooter from "@/components/layout/PublicFooter";

export default function ConfirmationPage({ application }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicNav />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-[#1a3c5e] mb-3">Application Submitted!</h1>
          <p className="text-slate-500 mb-2">
            Thank you, <strong>{application?.parent_first_name}</strong>! We've received your application for{" "}
            <strong>{application?.student_first_name}</strong>.
          </p>
          <p className="text-slate-500 mb-8">
            Our admissions team will review your application and follow up at{" "}
            <strong>{application?.email}</strong>. You can expect to hear from us within 3–5 business days.
          </p>

          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-8 text-left">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Application Summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Student</span><span className="font-medium">{application?.student_first_name} {application?.student_last_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Program</span><span className="font-medium">{application?.program_interest}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="inline-flex items-center px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">Submitted</span></div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/"><Button variant="outline">Back to Home</Button></Link>
            <Link to="/contact"><Button className="bg-[#1a3c5e] hover:bg-[#0d2540]">Contact Admissions</Button></Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}