import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Dumbbell, Monitor, Layers, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const DAYS = [
  {
    key: "MON",
    label: "MON",
    color: "#3B82F6",
    title: "Literacy & Numeracy",
    description: "Focused 90-minute sessions on reading comprehension, writing mechanics, and numeracy skills. Two session blocks serving all grade levels K–12.",
    sessions: ["09:00–10:30 · SESSION 01: K–2, 5–6, 9–12", "11:00–12:30 · SESSION 02: 3–4, 7–8, 9–12"],
  },
  {
    key: "TUE",
    label: "TUE",
    color: "#10B981",
    title: "STEM & Project Learning",
    description: "Hands-on science, technology, engineering, and math through project-based learning. Students work collaboratively on real-world challenges.",
    sessions: ["09:00–10:30 · SESSION 01: K–2, 5–6, 9–12", "11:00–12:30 · SESSION 02: 3–4, 7–8, 9–12"],
  },
  {
    key: "WED",
    label: "WED",
    color: "#F59E0B",
    title: "Home Learning",
    description: "Wednesday is dedicated to guided home learning. Families receive structured activities and assignments that reinforce the week's on-site instruction. This model respects family time and builds student independence.",
    sessions: ["Guided activities at home", "Structured assignments provided", "Parent partnership day"],
  },
  {
    key: "THU",
    label: "THU",
    color: "#8B5CF6",
    title: "Writing & Humanities",
    description: "Deep dives into writing craft, history, social studies, literature, and the arts. Students develop critical thinking and communication skills.",
    sessions: ["09:00–10:30 · SESSION 01: K–2, 5–6, 9–12", "11:00–12:30 · SESSION 02: 3–4, 7–8, 9–12"],
  },
  {
    key: "FRI",
    label: "FRI",
    color: "#64748B",
    title: "Home Learning + Enrichment",
    description: "Friday is dedicated to student-directed growth. Students participate in clubs, seminars, special activities, and tutoring sessions.",
    sessions: ["Clubs & Interest Groups", "Academic Seminars", "Enrichment Activities", "Tutoring Support"],
  },
];

const PROGRAMS = [
  {
    icon: Monitor,
    title: "Virtual Homeschool Support",
    description: "K–12 virtual support with a dedicated academic coach via synchronous and asynchronous learning.",
    price: "$199",
    billing: "per month",
    color: "#8B5CF6",
    href: "/virtual-homeschool",
  },
  {
    icon: BookOpen,
    title: "Hybrid Microschool",
    description: "K–12 education with maximum 10 students per class. Three on-site days focused on literacy, STEM, and humanities.",
    price: "$7,500",
    billing: "per year",
    color: "#3B82F6",
    href: "/academics",
  },
  {
    icon: Dumbbell,
    title: "Elite Performance Training",
    description: "4 sessions per week of elite training covering speed, strength, conditioning, nutrition, and college recruiting preparation.",
    price: "$500",
    billing: "per month",
    color: "#10B981",
    href: "/athletics",
  },
];

const BENEFITS = [
  { title: "10:1 Student Ratio", description: "Maximum 10 students per class ensures personalized attention and mastery-based learning.", color: "#3B82F6" },
  { title: "Academic Acceleration", description: "Students typically advance 2–3 grade levels compared to peers in traditional schools.", color: "#10B981" },
  { title: "Whole-Athlete Development", description: "Training encompasses physical performance, nutrition, mental performance, and discipline.", color: "#8B5CF6" },
  { title: "College & NIL Prep", description: "NCAA recruiting guidance, D1 preparation, NIL education, and scholarship navigation from day one.", color: "#3B82F6" },
  { title: "Parent Visibility", description: "Parents stay connected to their student's academic progress, attendance, and athletic development in real time.", color: "#F59E0B" },
  { title: "Student Rewards", description: "A built-in rewards system recognizing academic effort, athletic milestones, and character development.", color: "#10B981" },
  { title: "Flexible Learning Paths", description: "Hybrid on-site, virtual homeschool support, or standalone athletic training — combine programs to fit your family.", color: "#8B5CF6" },
  { title: "Elite Mentorship", description: "Access to professional coaches, former D1 athletes, sports nutritionists, and NIL attorneys.", color: "#F59E0B" },
];

const PLANS = [
  {
    tag: "MICROSCHOOL",
    title: "Hybrid Program",
    price: "$7,500",
    billing: "per year",
    sub: "$750/mo for 10 months",
    color: "#3B82F6",
    features: ["K–12 hybrid education", "3 on-site days per week", "Max 10 students per class", "Literacy, STEM & Humanities", "Home learning partnership", "$500 enrollment deposit"],
    href: "/apply",
  },
  {
    tag: "PERFORMANCE",
    title: "Athletic Program",
    price: "$500",
    billing: "per month",
    sub: "per athlete",
    color: "#10B981",
    features: ["4 weekly training sessions", "Speed & strength development", "Conditioning & mobility", "Sports nutrition education", "NIL & recruiting workshops", "Elite mentorship network"],
    href: "/apply",
  },
  {
    tag: "VIRTUAL",
    title: "Virtual Homeschool",
    price: "$199",
    billing: "per month",
    sub: "K–12 personalized support",
    color: "#8B5CF6",
    features: ["K–12 virtual support", "Dedicated academic coach", "1–3 sessions per week", "Synchronous & asynchronous", "Personalized learning plans", "Flexible scheduling"],
    href: "/apply",
  },
  {
    tag: "BEST VALUE",
    title: "Combination Package",
    price: "10% OFF",
    billing: "any combination",
    sub: "Hybrid + Athletic or Virtual + Athletic",
    color: "#F59E0B",
    features: ["Hybrid + Athletic Program", "Virtual + Athletic Program", "10% discount on total", "Integrated scheduling", "Priority family consultation", "Combined program mentorship"],
    href: "/apply",
  },
];

const STATS = [
  { value: "K–12", label: "GRADES SERVED" },
  { value: "10:1", label: "STUDENT RATIO" },
  { value: "4x", label: "WEEKLY TRAINING" },
  { value: "D1", label: "RECRUITING PREP" },
];

function SectionLabel({ text, color = "#3B82F6" }) {
  return (
    <div className="flex items-center gap-3 justify-center mb-4">
      <div className="h-px w-8" style={{ backgroundColor: color }} />
      <span className="text-xs font-mono tracking-widest uppercase" style={{ color }}>{text}</span>
      <div className="h-px w-8" style={{ backgroundColor: color }} />
    </div>
  );
}

export default function PublicHome() {
  const [activeDay, setActiveDay] = useState("MON");
  const selectedDay = DAYS.find(d => d.key === activeDay);

  return (
    <div className="bg-[#0A0F1A]">

      {/* ── HERO ── */}
      <section className="relative py-28 px-6 text-white overflow-hidden bg-[#0A0F1A]">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize: "20px 20px" }} />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <p className="text-xs font-mono tracking-widest text-[#3B82F6] uppercase mb-6">
            ACADEMICS · ATHLETICS · COLLEGE PREP · PARENT VISIBILITY
          </p>
          <h1 className="font-black leading-[0.9] tracking-tight mb-6">
            <span className="block text-7xl md:text-9xl text-white">ELEVATE</span>
            <span className="block text-4xl md:text-6xl mt-2">
              <span className="text-[#3B82F6]">EDUCATION</span>
              <span className="text-slate-500 mx-3">&</span>
              <span className="text-[#10B981]">PERFORMANCE</span>
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            A hybrid microschool and elite athletic development academy combining academic coaching, performance training, virtual homeschool support, college and NIL guidance – serving K–12 families across Oregon, Nevada, California, Hawaii, and beyond.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <Link to="/apply">
              <Button size="lg" className="bg-[#10B981] text-white hover:bg-[#059669] font-bold shadow-lg">
                APPLY NOW <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admissions">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                SCHEDULE A TOUR
              </Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="border-t border-white/5 pt-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label }, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl md:text-4xl font-black text-white mb-1">{value}</p>
                <p className="text-xs font-mono tracking-widest text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center mt-12">
          <ChevronDown className="w-5 h-5 text-slate-600 animate-bounce" />
        </div>
      </section>

      {/* ── PROGRAMS ── */}
      <section className="py-20 px-6 bg-[#0D1117]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel text="OUR PROGRAMS" color="#3B82F6" />
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              CHOOSE YOUR PATH.<br />
              <span className="text-slate-500">ON ONE PLATFORM.</span>
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              Students can enroll in academics, athletics, or virtual homeschool support — independently or in any combination. Every path includes parent visibility and student rewards.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PROGRAMS.map(({ icon: Icon, title, description, price, billing, color, href }) => (
              <div key={title} className="bg-[#1E293B] rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-all group">
                <div className="h-1" style={{ backgroundColor: color }} />
                <div className="p-6 flex flex-col h-full">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${color}20` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-tight mb-2">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed flex-1 mb-5">{description}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-black text-white">{price}</span>
                      <span className="text-slate-500 text-sm ml-1">/ {billing}</span>
                    </div>
                    <Link to={href}>
                      <Button size="sm" className="text-white font-semibold" style={{ backgroundColor: color }}>
                        APPLY NOW
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link to="/apply">
              <Button variant="outline" className="border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10">
                <Layers className="w-4 h-4 mr-2" /> Combination Package — 10% OFF any two programs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SCHEDULE ── */}
      <section className="py-20 px-6 bg-[#0A0F1A]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel text="WEEKLY SCHEDULE" color="#10B981" />
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              A WEEK IN THE <span className="text-[#10B981]">LIFE</span>
            </h2>
          </div>

          {/* Day tabs */}
          <div className="flex gap-2 mb-8 justify-center flex-wrap">
            {DAYS.map(day => (
              <button
                key={day.key}
                onClick={() => setActiveDay(day.key)}
                className="px-4 py-2 rounded-lg text-sm font-mono font-bold tracking-widest transition-all"
                style={activeDay === day.key
                  ? { backgroundColor: day.color, color: "#fff" }
                  : { backgroundColor: "#1E293B", color: "#64748B" }
                }
              >
                {day.label}
              </button>
            ))}
          </div>

          {/* Day detail */}
          {selectedDay && (
            <div className="bg-[#1E293B] rounded-2xl border border-white/5 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ backgroundColor: selectedDay.color }} />
                <span className="text-xs font-mono tracking-widest uppercase" style={{ color: selectedDay.color }}>{selectedDay.key}</span>
                <div className="h-px flex-1" style={{ backgroundColor: selectedDay.color }} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">{selectedDay.title}</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">{selectedDay.description}</p>
              <div className="space-y-2">
                {selectedDay.sessions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedDay.color }} />
                    <span className="text-slate-300 font-mono">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── WHY ELEVATE ── */}
      <section className="py-20 px-6 bg-[#0D1117]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel text="THE ELEVATE ADVANTAGE" color="#10B981" />
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              WHY FAMILIES <span className="text-[#10B981]">CHOOSE ELEVATE</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map(({ title, description, color }) => (
              <div key={title} className="bg-[#1E293B]/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all">
                <div className="w-2 h-2 rounded-full mb-3" style={{ backgroundColor: color }} />
                <h4 className="font-black text-white text-sm uppercase tracking-tight mb-2">{title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TUITION ── */}
      <section className="py-20 px-6 bg-[#0A0F1A]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel text="INVESTMENT" color="#3B82F6" />
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              TUITION <span className="text-[#3B82F6]">OVERVIEW</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map(({ tag, title, price, billing, sub, color, features, href }) => (
              <div key={title} className="bg-[#1E293B] rounded-2xl border border-white/5 overflow-hidden flex flex-col" style={{ borderColor: color === "#F59E0B" ? `${color}40` : undefined }}>
                <div className="h-0.5" style={{ backgroundColor: color }} />
                <div className="p-5 flex flex-col flex-1">
                  <span className="text-xs font-mono font-bold tracking-widest mb-3 inline-block px-2 py-0.5 rounded" style={{ color, backgroundColor: `${color}15` }}>{tag}</span>
                  <h3 className="font-black text-white uppercase tracking-tight mb-1 text-sm">{title}</h3>
                  <div className="my-3">
                    <span className="text-2xl font-black text-white">{price}</span>
                    <span className="text-slate-500 text-xs ml-1">/ {billing}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                  <ul className="space-y-1.5 flex-1 mb-4">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" style={{ color }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to={href}>
                    <Button size="sm" className="w-full text-white font-bold text-xs" style={{ backgroundColor: color }}>
                      APPLY NOW
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-[#0D1117]">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-[#1E293B] to-[#0A0F1A] border border-white/10 rounded-3xl p-12 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-4 leading-tight">
            READY TO<br /><span className="text-[#10B981]">ELEVATE?</span>
          </h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
            Join a community of families committed to academic excellence, elite athletic development, and real-time visibility into their student's journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/apply">
              <Button size="lg" className="bg-[#10B981] text-white hover:bg-[#059669] font-bold shadow-lg">
                INITIATE APPLICATION <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admissions">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                SCHEDULE A TOUR
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
