import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { Link } from "react-router-dom";
import HeroSection from "@/components/public/HeroSection";
import CmsContent from "@/components/public/CmsContent";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

const SLUG_MAP = {
  academics: "academics",
  athletics: "athletics",
  "virtual-homeschool": "virtual-homeschool",
  "college-nil": "college-nil",
};

export default function ProgramPage({ programType }) {
  const pageSlug = SLUG_MAP[programType] || programType;

  const { data: allCms = [] } = useQuery({
    queryKey: ["cms-all-public"],
    queryFn: () => apiGet('/cms'),
  });

  const page = allCms.find(r => r.section === "pages" && r.key === pageSlug);
  const program = allCms.find(r => r.section === "programs" && r.key === pageSlug);
  const pricing = allCms.find(r => r.section === "pricing" && r.key?.includes(pageSlug));

  return (
    <div>
      <HeroSection
        headline={page?.title || program?.title || "Program Details"}
        subheadline={page?.body || null}
        ctaLabel="Apply Now"
        ctaHref="/apply"
      />

      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          {program ? (
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-2xl font-bold text-[#1a3c5e] mb-4">About This Program</h2>
                <p className="text-slate-600 mb-6">{program.body}</p>
              </div>

              <div>
                {pricing && (
                  <div className="bg-[#1a3c5e] text-white rounded-2xl p-8">
                    <h3 className="text-xl font-bold mb-4">{pricing.title}</h3>
                    <div className="text-slate-300 text-sm mb-6">{pricing.body}</div>
                    <Link to="/apply">
                      <Button className="w-full bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold">
                        Apply Now <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )}

                {page?.body && !pricing && (
                  <div className="mt-8 bg-slate-50 rounded-xl p-6">
                    <CmsContent content={page.body} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-400">Program details are being updated. Check back soon.</p>
              <Link to="/apply" className="mt-4 inline-block">
                <Button className="bg-[#1a3c5e] hover:bg-[#0d2540]">
                  Apply Now <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
