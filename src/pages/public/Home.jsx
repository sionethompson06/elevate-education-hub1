import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroSection from "@/components/public/HeroSection";
import ProgramCard from "@/components/public/ProgramCard";

export default function Home() {
  const { data: allCms = [] } = useQuery({
    queryKey: ["cms-all-public"],
    queryFn: () => apiGet('/cms'),
  });

  const page = allCms.find(r => r.section === "pages" && r.key === "home");
  const cmsPrograms = allCms
    .filter(r => r.section === "programs")
    .map(p => ({ ...p, name: p.title, description: p.body }));

  return (
    <div>
      <HeroSection
        headline={page?.title || "Elevate Your Potential. Academic + Athletic Excellence."}
        subheadline={page?.body || "A centralized hub for students, parents, coaches, and administrators."}
        ctaLabel="Apply Now"
        ctaHref="/apply"
      />

      {/* Programs section */}
      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1a3c5e] mb-3">Our Programs</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Comprehensive programs designed to develop every dimension of the student-athlete.
            </p>
          </div>
          {cmsPrograms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cmsPrograms.map((p) => (
                <ProgramCard key={p.id} program={p} />
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400">Programs coming soon.</p>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "200+", label: "College Scholarships" },
            { value: "$3M+", label: "in NIL Deals Secured" },
            { value: "100%", label: "College Acceptance Rate" },
            { value: "3.4+", label: "Average Student GPA" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-4xl font-bold text-[#1a3c5e] mb-1">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#1a3c5e] to-[#0d2540] text-white text-center">
        <h2 className="text-3xl font-bold mb-3">Ready to Elevate?</h2>
        <p className="text-slate-300 mb-8 max-w-md mx-auto">
          Join Elevate Performance Academy and start your journey to excellence today.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/apply">
            <Button size="lg" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold">
              Start Your Application <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <Link to="/admissions">
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              Learn More
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
