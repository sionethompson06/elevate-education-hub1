import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import HeroSection from "@/components/public/HeroSection";
import CmsContent from "@/components/public/CmsContent";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const STEPS = [
  { num: "01", title: "Apply Online", desc: "Complete our short application sharing your academic and athletic background." },
  { num: "02", title: "Intro Call", desc: "A 30-minute call with our admissions team to learn more about your goals." },
  { num: "03", title: "Program Match", desc: "We recommend the right program(s) based on your needs and goals." },
  { num: "04", title: "Enroll & Meet Your Coaches", desc: "Complete enrollment and get introduced to your dedicated coaches." },
];

export default function Admissions() {
  const { data: pages = [] } = useQuery({
    queryKey: ["cms-page", "admissions"],
    queryFn: () => base44.entities.CmsPage.filter({ slug: "admissions", status: "published" }),
  });

  const page = pages[0];

  return (
    <div>
      <HeroSection
        headline={page?.hero_headline || "Join the Elevate Community"}
        subheadline={page?.hero_subheadline || "Our admissions process is designed to find the right fit for every student-athlete."}
        ctaLabel={page?.hero_cta_label || "Start Your Application"}
        ctaHref={page?.hero_cta_href || "/apply"}
        imageUrl={page?.hero_image_url}
      />

      {/* Process */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1a3c5e] mb-10 text-center">How to Apply</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="text-center">
                <div className="w-14 h-14 bg-[#1a3c5e] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {num}
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Body content from CMS */}
      {page?.body_content && (
        <section className="py-12 px-6 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <CmsContent content={page.body_content} />
          </div>
        </section>
      )}

      {/* What we look for */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-[#1a3c5e] mb-4">What We Look For</h2>
          <p className="text-slate-500 mb-8">
            We accept students at all academic and athletic levels. What matters most is commitment to growth and coachability.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {["Coachability", "Commitment to Growth", "Academic Effort", "Athletic Drive", "Character"].map((v) => (
              <div key={v} className="flex items-center gap-2 bg-blue-50 text-[#1a3c5e] px-4 py-2 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> {v}
              </div>
            ))}
          </div>
          <Link to="/apply">
            <Button size="lg" className="bg-[#1a3c5e] hover:bg-[#0d2540] font-bold">
              Start Your Application <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}