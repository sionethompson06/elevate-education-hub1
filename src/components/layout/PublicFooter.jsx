import { Link } from "react-router-dom";
import { GraduationCap, Mail, Phone, MapPin } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer className="bg-[#0A0F1A] text-slate-400 py-12 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-5 h-5 text-[#3B82F6]" />
              <span className="font-black text-sm bg-gradient-to-r from-[#3B82F6] to-[#10B981] bg-clip-text text-transparent tracking-tight">
                ELEVATE PERFORMANCE ACADEMY
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-3">
              A hybrid microschool and elite athletic development academy serving K–12 families.
            </p>
            <p className="text-xs text-slate-500">Oregon · Nevada · California · Hawaii · and more</p>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold mb-3 uppercase tracking-widest">Programs</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/academics" className="hover:text-white transition-colors">Academics</Link></li>
              <li><Link to="/athletics" className="hover:text-white transition-colors">Athletics</Link></li>
              <li><Link to="/virtual-homeschool" className="hover:text-white transition-colors">Virtual Homeschool</Link></li>
              <li><Link to="/college-nil" className="hover:text-white transition-colors">College &amp; NIL</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold mb-3 uppercase tracking-widest">Connect</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/admissions" className="hover:text-white transition-colors">Admissions</Link></li>
              <li><Link to="/apply" className="hover:text-white transition-colors">Apply Now</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold mb-3 uppercase tracking-widest">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                <a href="mailto:admissions@elevateperformance-academy.com" className="hover:text-white transition-colors break-all">
                  admissions@elevateperformance-academy.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#10B981] shrink-0" />
                <a href="tel:8083837519" className="hover:text-white transition-colors">808-383-7519</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                <span>Oregon, Nevada, California, Hawaii, and more</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 text-center text-xs text-slate-500">
          © 2026 ELEVATE PERFORMANCE ACADEMY. ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}
