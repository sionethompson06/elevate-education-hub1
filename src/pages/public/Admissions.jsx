import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Dumbbell, Layers, CheckCircle2 } from "lucide-react";

const STEPS = [
  { num: "01", title: "Submit Application", desc: "Complete the online application form with student and family information.", color: "#3B82F6" },
  { num: "02", title: "Family Consultation", desc: "Meet with our team to discuss your student's goals and program fit.", color: "#10B981" },
  { num: "03", title: "Evaluation", desc: "We review academic history, athletic background, and family alignment.", color: "#8B5CF6" },
  { num: "04", title: "Enrollment", desc: "Receive your offer, submit the deposit, and join the EPA community.", color: "#F59E0B" },
];

const PROGRAMS = [
  {
    icon: BookOpen,
    tag: "MICROSCHOOL",
    title: "Hybrid Program",
    price: "$7,500",
    billing: "per year",
    sub: "$750/month × 10 months · $500 deposit",
    color: "#3B82F6",
    features: ["K–12 hybrid education", "3 on-site days per week", "Max 10 students per class", "Literacy, STEM & Humanities", "Wednesday home learning", "40 student enrollment cap"],
  },
  {
    icon: Dumbbell,
    tag: "PERFORMANCE",
    title: "Athletic Program",
    price: "$500",
    billing: "per month",
    sub: "Per athlete",
    color: "#10B981",
    features: ["4 sessions per week (60 min)", "Speed, strength & conditioning", "Sports nutrition education", "Mental performance training", "NIL & recruiting workshops", "Elite mentorship access"],
  },
  {
    icon: Layers,
    tag: "FULL PROGRAM",
    title: "Combined Enrollment",
    price: "Contact",
    billing: "for pricing",
    sub: "Best value for complete development",
    color: "#8B5CF6",
    features: ["Full academic program", "Full athletic training program", "Integrated scheduling", "Priority mentorship access", "Combined family discount", "Complete student-athlete pathway"],
  },
];

const VALUES = ["Coachability", "Commitment to Growth", "Academic Effort", "Athletic Drive", "Character & Integrity"];

export default function Admissions() {
  return (
    <div className="bg-[#0A0F1A]">
      {/* Hero */}
      <section className="py-20 px-6 text-white border-b border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono tracking-widest text-[#10B981] uppercase mb-4">ENROLLMENT</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            ADMISSIONS
          </h1>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Three enrollment paths designed to meet the unique needs of every family. Choose academics, athletics, or both.
          </p>
          <Link to="/apply">
            <Button size="lg" className="bg-[#10B981] text-white hover:bg-[#059669] font-bold">
              INITIATE APPLICATION <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Enrollment options */}
      <section className="py-20 px-6 bg-[#0D1117]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-mono tracking-widest text-[#3B82F6] uppercase mb-3">CHOOSE YOUR PATH</p>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight">ENROLLMENT OPTIONS</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PROGRAMS.map(({ icon: Icon, tag, title, price, billing, sub, color, features }) => (
              <div key={title} className="bg-[#1E293B] rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                <div className="h-0.5" style={{ backgroundColor: color }} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${color}20` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <span className="text-xs font-mono font-bold tracking-widest mb-2 inline-block" style={{ color }}>{tag}</span>
                  <h3 className="font-black text-white uppercase tracking-tight mb-1">{title}</h3>
                  <div className="my-3">
                    <span className="text-2xl font-black text-white">{price}</span>
                    <span className="text-slate-500 text-xs ml-1">/ {billing}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                  <ul className="space-y-1.5 flex-1 mb-5">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" style={{ color }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/apply">
                    <Button size="sm" className="w-full text-white font-bold" style={{ backgroundColor: color }}>
                      APPLY NOW
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admissions process */}
      <section className="py-20 px-6 bg-[#0A0F1A]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-mono tracking-widest text-[#3B82F6] uppercase mb-3">HOW IT WORKS</p>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight">ADMISSIONS PROCESS</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map(({ num, title, desc, color }, i) => (
              <div key={num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(50%+28px)] right-0 h-px bg-white/5" />
                )}
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-black mx-auto mb-4 border-2" style={{ borderColor: color, color, backgroundColor: `${color}10` }}>
                    {num}
                  </div>
                  <h3 className="font-black text-white uppercase tracking-tight text-sm mb-2">{title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we look for */}
      <section className="py-20 px-6 bg-[#0D1117]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono tracking-widest text-[#10B981] uppercase mb-3">SELECTION CRITERIA</p>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">WHAT WE LOOK FOR</h2>
          <p className="text-slate-400 mb-8">
            We accept students at all academic and athletic levels. What matters most is commitment to growth and coachability.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            {VALUES.map(v => (
              <div key={v} className="flex items-center gap-2 bg-[#1E293B] border border-white/10 text-slate-300 px-4 py-2 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> {v}
              </div>
            ))}
          </div>
          <Link to="/apply">
            <Button size="lg" className="bg-[#10B981] text-white hover:bg-[#059669] font-bold">
              START YOUR APPLICATION <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
