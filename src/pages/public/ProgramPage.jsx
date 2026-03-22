import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useParams } from "react-router-dom";
import HeroSection from "@/components/public/HeroSection";
import CmsContent from "@/components/public/CmsContent";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

// slug mapping from URL paths
const SLUG_MAP = {
  academics: "academics",
  athletics: "athletics",
  "virtual-homeschool": "virtual-homeschool",
  "college-nil": "college-nil",
};

export default function ProgramPage({ pageSlug }) {
  const { data: pages = [] } = useQuery({
    queryKey: ["cms-page", pageSlug],
    queryFn: () => base44.entities.CmsPage.filter({ slug: pageSlug, status: "published" }),
  });
  const { data: programs = [] } = useQuery({
    queryKey: ["cms-program", pageSlug],
    queryFn: () => base44.entities.CmsProgram.filter({ slug: pageSlug, status: "published" }),
  });
  const { data: pricingPlans = [] } = useQuery({
    queryKey: ["cms-pricing", pageSlug],
    queryFn: () => base44.entities.CmsPricingPlan.filter({ program_slug: pageSlug, status: "published" }),
  });

  const page = pages[0];
  const program = programs[0];
  const pricing = pricingPlans[0];

  return (
    <div>
      <HeroSection
        headline={page?.hero_headline || program?.name || "Program Details"}
        subheadline={page?.hero_subheadline || program?.tagline}
        ctaLabel={page?.hero_cta_label || "Apply Now"}
        ctaHref={page?.hero_cta_href || "/apply"}
        imageUrl={page?.hero_image_url}
      />

      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          {program ? (
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-2xl font-bold text-[#1a3c5e] mb-4">About This Program</h2>
                <p className="text-slate-600 mb-6">{program.description}</p>

                {program.features?.length > 0 && (
                  <>
                    <h3 className="font-semibold text-slate-800 mb-3">What's Included</h3>
                    <ul className="space-y-2 mb-6">
                      {program.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {program.who_its_for && (
                  <>
                    <h3 className="font-semibold text-slate-800 mb-2">Who It's For</h3>
                    <p className="text-sm text-slate-600 mb-6">{program.who_its_for}</p>
                  </>
                )}

                {program.outcomes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-yellow-800">📈 Results</p>
                    <p className="text-sm text-yellow-700 mt-1">{program.outcomes}</p>
                  </div>
                )}
              </div>

              <div>
                {pricing && (
                  <div className="bg-[#1a3c5e] text-white rounded-2xl p-8">
                    <h3 className="text-xl font-bold mb-1">{pricing.name}</h3>
                    <div className="mb-2">
                      <span className="text-4xl font-bold">${pricing.price_monthly?.toLocaleString()}</span>
                      <span className="text-slate-300 text-sm ml-1">/month</span>
                    </div>
                    {pricing.price_annual && (
                      <p className="text-yellow-400 text-sm mb-4">
                        ${pricing.price_annual?.toLocaleString()}/year (save 2 months)
                      </p>
                    )}
                    {pricing.billing_note && (
                      <p className="text-slate-300 text-xs mb-6">{pricing.billing_note}</p>
                    )}
                    <Link to="/apply">
                      <Button className="w-full bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold">
                        Apply Now <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )}

                {page?.body_content && (
                  <div className="mt-8 bg-slate-50 rounded-xl p-6">
                    <CmsContent content={page.body_content} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-400">Program details are being updated. Check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}