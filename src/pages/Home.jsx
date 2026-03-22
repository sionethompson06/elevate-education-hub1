import { Link } from "react-router-dom";
import { GraduationCap, ArrowRight, BookOpen, Activity, Globe, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { getDashboardForRole } from "@/lib/rbac";

export default function Home() {
  const { user } = useAuth();

  const programs = [
    {
      icon: BookOpen,
      title: "Academics",
      description: "Personalized academic coaching and tutoring for student excellence.",
      href: "/academics",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: Activity,
      title: "Athletics",
      description: "Elite performance training tailored to each athlete's goals.",
      href: "/athletics",
      color: "bg-green-50 text-green-600",
    },
    {
      icon: Globe,
      title: "Virtual Homeschool",
      description: "Flexible, accredited curriculum delivered online.",
      href: "/virtual-homeschool",
      color: "bg-purple-50 text-purple-600",
    },
    {
      icon: Trophy,
      title: "College & NIL",
      description: "Preparing student-athletes for college recruitment and NIL opportunities.",
      href: "/college-nil",
      color: "bg-yellow-50 text-yellow-600",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="bg-[#1a3c5e] text-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <GraduationCap className="w-6 h-6" />
          Elevate Education Hub
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/academics" className="hover:text-slate-300 hidden md:block">Academics</Link>
          <Link to="/athletics" className="hover:text-slate-300 hidden md:block">Athletics</Link>
          <Link to="/admissions" className="hover:text-slate-300 hidden md:block">Admissions</Link>
          <Link to="/faq" className="hover:text-slate-300 hidden md:block">FAQ</Link>
          {user ? (
            <Link to={getDashboardForRole(user.role)}>
              <Button size="sm" className="bg-white text-[#1a3c5e] hover:bg-slate-100">
                My Portal
              </Button>
            </Link>
          ) : (
            <Link to="/apply">
              <Button size="sm" className="bg-white text-[#1a3c5e] hover:bg-slate-100">
                Apply Now
              </Button>
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1a3c5e] to-[#0d2540] text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Elevate Your Potential.<br />
            <span className="text-yellow-400">Academic + Athletic Excellence.</span>
          </h1>
          <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
            A centralized hub for students, parents, coaches, and administrators at Elevate Performance Academy.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/apply">
              <Button size="lg" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold">
                Apply Now <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admissions">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1a3c5e] text-center mb-10">Our Programs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {programs.map(({ icon: Icon, title, description, href, color }) => (
              <Link to={href} key={title}>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#1a3c5e] transition-all h-full">
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-4`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
                  <p className="text-sm text-slate-500">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-[#1a3c5e] text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Ready to Elevate?</h2>
        <p className="text-slate-300 mb-6">Start your application today and join the Elevate community.</p>
        <Link to="/apply">
          <Button size="lg" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold">
            Start Your Application
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 px-6 text-center text-sm">
        <p>© 2026 Elevate Performance Academy. All rights reserved.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/cancellation-policy" className="hover:text-white">Cancellation Policy</Link>
          <Link to="/contact" className="hover:text-white">Contact</Link>
          <Link to="/faq" className="hover:text-white">FAQ</Link>
        </div>
      </footer>
    </div>
  );
}