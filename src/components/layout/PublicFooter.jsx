import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 text-white font-bold mb-3">
              <GraduationCap className="w-5 h-5 text-yellow-400" />
              Elevate Education Hub
            </div>
            <p className="text-sm leading-relaxed">
              Developing champion student-athletes through personalized coaching and academic excellence.
            </p>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Programs</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/academics" className="hover:text-white transition-colors">Academics</Link></li>
              <li><Link to="/athletics" className="hover:text-white transition-colors">Athletics</Link></li>
              <li><Link to="/virtual-homeschool" className="hover:text-white transition-colors">Virtual Homeschool</Link></li>
              <li><Link to="/college-nil" className="hover:text-white transition-colors">College & NIL</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/admissions" className="hover:text-white transition-colors">Admissions</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 text-center text-xs">
          © 2026 Elevate Performance Academy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}