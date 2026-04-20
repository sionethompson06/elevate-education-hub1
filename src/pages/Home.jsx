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
    accent: "border-t-4 border-t-[#3B82F6]",
    iconBg: "bg-blue-500/10 text-[#3B82F6]",
    tag: "Core Program",
  },
  {
    icon: HomeIcon,
    title: "Homeschool Support",
    description: "Flexible, structured curriculum with coach-guided learning for home-educated students K–12.",
    href: "/virtual-homeschool",
    accent: "border-t-4 border-t-[#8B5CF6]",
    iconBg: "bg-purple-500/10 text-[#8B5CF6]",
    tag: "Core Program",
  },
  {
    icon: Activity,
    title: "Athletic Performance",
    description: "Elite speed, strength, conditioning, and sport-specific training. 4 sessions per week.",
    href: "/athletics",
    accent: "border-t-4 border-t-[#10B981]",
    iconBg: "bg-emerald-500/10 text-[#10B981]",
    tag: "Core Program",
  },
  {
    icon: Trophy,
    title: "Recruitment & College Readiness",
    description: "College placement strategy, NIL navigation, and recruiting profile development from day one.",
    href: "/college-nil",
    accent: "border-t-4 border-t-[#F59E0B]",
    iconBg: "bg-amber-500/10 text-[#F59E0B]",
    tag: "Core Program",
  },
  {
    icon: Users,
    title: "Family Resource Center",
    description: "Parent education, family support resources, workshops, and community events.",
    href: "/hub/resources",
    accent: "border-t-4 border-t-pink-500",
    iconBg: "bg-pink-500/10 text-pink-400",
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
    <div className="min-h-screen bg-[#0A0F1A]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A0F1A] via-[#0D1117] to-[#1E293B] text-white py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize: "20px 20px" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/30 rounded-full px-4 py-1.5 text-[#10B981] text-xs font-mono tracking-widest uppercase mb-6">
            High-Performance Education Operating System
          </div>
          <h1 className="font-black mb-5 leading-tight tracking-tight">
            <span className="block text-4xl md:text-6xl text-white">Built for Student-Athletes.</span>
            <span className="block text-4xl md:text-6xl text-[#10B981]">Designed for Families.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            A hybrid microschool and elite athletic development academy combining academic coaching, performance training, virtual homeschool support, college and NIL guidance – serving K–12 families across Oregon, Nevada, California, Hawaii, and beyond.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/apply">
              <Button size="lg" className="bg-[#10B981] text-white hover:bg-[#059669] font-bold shadow-lg">
                Start Your Application <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            {user && (
              <Link to={getDashboardForRole(user.role)}>
                <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  Go to My Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* One-login promise */}
      <section className="py-14 px-6 bg-[#0D1117]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-black text-[#10B981] mb-2 uppercase tracking-tight">The One-Login Family Promise</h2>
            <p className="text-slate-500 text-sm">Everything your family needs — in one secure portal.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PROMISES.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                <ChevronRight className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <p className="text-sm text-slate-400">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 Program Hubs */}
      <section className="py-20 px-6 bg-[#0A0F1A]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-mono tracking-widest text-[#3B82F6] uppercase mb-3">WHAT WE OFFER</p>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-3">5 Core Program Hubs</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Every program is purpose-built — academically rigorous, athletically elite, and family-centered.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROGRAMS.map(({ icon: Icon, title, description, href, accent, iconBg, tag }) => (
              <Link to={href} key={title}>
                <div className={`bg-[#1E293B] rounded-2xl p-6 border border-white/5 hover:border-white/10 hover:shadow-lg transition-all h-full ${accent}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-white/5 px-2 py-1 rounded-full border border-white/5">{tag}</span>
                  </div>
                  <h3 className="font-black text-white mb-2 text-sm uppercase tracking-tight">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-[#10B981] gap-1">
                    Learn more <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-[#0D1117]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-3">
            READY TO <span className="text-[#10B981]">ELEVATE?</span>
          </h2>
          <p className="text-slate-400 mb-7 text-sm leading-relaxed">Join a community of student-athletes and families who demand more from their education and training.</p>
          <Link to="/apply">
            <Button size="lg" className="bg-[#10B981] text-white hover:bg-[#059669] font-bold shadow-lg">
              Start Your Application <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A0F1A] border-t border-white/5 text-slate-500 py-10 px-6 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-[#3B82F6]" />
          <span className="font-black text-sm bg-gradient-to-r from-[#3B82F6] to-[#10B981] bg-clip-text text-transparent tracking-tight">
            ELEVATE PERFORMANCE ACADEMY
          </span>
        </div>
        <p className="mb-3">© 2026 Elevate Performance Academy. All rights reserved.</p>
        <div className="flex justify-center gap-6 flex-wrap text-xs">
          <Link to="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link>
          <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link to="/apply" className="hover:text-white transition-colors">Apply</Link>
        </div>
      </footer>
    </div>
  );
}
