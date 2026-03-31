import { Link } from "react-router-dom";
import { GraduationCap, ArrowRight, BookOpen, Activity, Home as HomeIcon, Trophy, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { getDashboardForRole } from "@/lib/rbac";

const PROGRAMS = [
  {
    icon: BookOpen,
    title: "Academic Program",
    description: "Personalized academic coaching, tutoring, and structured learning plans for every student.",
    href: "/academics",
    accent: "border-t-4 border-t-blue-500",
    iconBg: "bg-blue-50 text-blue-600",
    tag: "Core Program",
  },
  {
    icon: HomeIcon,
    title: "Homeschool Support",
    description: "Flexible, accredited curriculum with coach-guided learning for home-educated students.",
    href: "/virtual-homeschool",
    accent: "border-t-4 border-t-purple-500",
    iconBg: "bg-purple-50 text-purple-600",
    tag: "Core Program",
  },
  {
    icon: Activity,
    title: "Athletic Performance",
    description: "Elite strength, conditioning, and sport-specific training tailored to each athlete.",
    href: "/athletics",
    accent: "border-t-4 border-t-orange-500",
    iconBg: "bg-orange-50 text-orange-600",
    tag: "Core Program",
  },
  {
    icon: Trophy,
    title: "Recruitment & College Readiness",
    description: "College placement strategy, NIL navigation, and recruiting profile development.",
    href: "/college-nil",
    accent: "border-t-4 border-t-emerald-500",
    iconBg: "bg-emerald-50 text-emerald-600",
    tag: "Core Program",
  },
  {
    icon: Users,
    title: "Family Resource Center",
    description: "Parent education, family support resources, workshops, and community events.",
    href: "/resources",
    accent: "border-t-4 border-t-pink-500",
    iconBg: "bg-pink-50 text-pink-600",
    tag: "Support Hub",
  },
];

const PROMISES = [
  "One login — academic plan, training plan, schedule, attendance, progress, messages, billing, all in one place.",
  "Academic coaches and performance coaches aligned on every student.",
  "Transparent progress reporting across every program area.",
  "Flexible enrollment paths: academic-only, athletic-only, or the full student-athlete experience.",
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0d2540] via-[#1a3c5e] to-[#1a4f7a] text-white py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize: "20px 20px" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/40 rounded-full px-4 py-1.5 text-yellow-300 text-xs font-semibold tracking-wide uppercase mb-6">
            High-Performance Education Operating System
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-tight tracking-tight">
            Built for Student-Athletes.<br />
            <span className="text-yellow-400">Designed for Families.</span>
          </h1>
          <p className="text-slate-300 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Elevate unifies academics, athletics, scheduling, progress, and communication — one platform, one login, every student.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/apply">
              <Button size="lg" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold shadow-lg">
                Start Your Application <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            {user && (
              <Link to={getDashboardForRole(user.role)}>
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                  Go to My Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* One-login promise */}
      <section className="py-14 px-6 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-yellow-400 mb-2">The One-Login Family Promise</h2>
            <p className="text-slate-400 text-sm">Everything your family needs — in one secure portal.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PROMISES.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <ChevronRight className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-300">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 Program Hubs */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1a3c5e] mb-3">5 Core Program Hubs</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Every program is purpose-built — academically rigorous, athletically elite, and family-centered.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROGRAMS.map(({ icon: Icon, title, description, href, accent, iconBg, tag }) => (
              <Link to={href} key={title}>
                <div className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all h-full ${accent}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">{tag}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2 text-base">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-[#1a3c5e] gap-1">
                    Learn more <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gradient-to-r from-[#1a3c5e] to-[#0d2540] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Ready to Elevate?</h2>
          <p className="text-slate-300 mb-7 text-sm leading-relaxed">Join a community of student-athletes and families who demand more from their education and training.</p>
          <Link to="/apply">
            <Button size="lg" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold shadow-lg">
              Start Your Application <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-10 px-6 text-center text-sm">
        <div className="flex items-center justify-center gap-2 text-white font-semibold mb-4">
          <GraduationCap className="w-5 h-5 text-yellow-400" />
          Elevate Education Hub
        </div>
        <p className="mb-3">© 2026 Elevate Performance Academy. All rights reserved.</p>
        <div className="flex justify-center gap-6 flex-wrap">
          <Link to="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link>
          <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link to="/apply" className="hover:text-white transition-colors">Apply</Link>
        </div>
      </footer>
    </div>
  );
}