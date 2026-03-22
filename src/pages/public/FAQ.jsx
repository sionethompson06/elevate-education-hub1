import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import HeroSection from "@/components/public/HeroSection";
import { ChevronDown, ChevronUp } from "lucide-react";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "general", label: "General" },
  { key: "enrollment", label: "Enrollment" },
  { key: "billing", label: "Billing" },
  { key: "academics", label: "Academics" },
  { key: "athletics", label: "Athletics" },
];

export default function FAQ() {
  const [openId, setOpenId] = useState(null);
  const [category, setCategory] = useState("all");

  const { data: pages = [] } = useQuery({
    queryKey: ["cms-page", "faq"],
    queryFn: () => base44.entities.CmsPage.filter({ slug: "faq", status: "published" }),
  });
  const { data: faqs = [] } = useQuery({
    queryKey: ["cms-faqs"],
    queryFn: () => base44.entities.CmsFaqItem.filter({ status: "published" }),
  });

  const page = pages[0];
  const sorted = [...faqs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const filtered = category === "all" ? sorted : sorted.filter((f) => f.category === category);

  return (
    <div>
      <HeroSection
        headline={page?.hero_headline || "Frequently Asked Questions"}
        subheadline={page?.hero_subheadline || "Find answers to the most common questions."}
        imageUrl={page?.hero_image_url}
      />

      <section className="py-16 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            {CATEGORIES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === key
                    ? "bg-[#1a3c5e] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No FAQ items found for this category.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((faq) => (
                <div key={faq.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  >
                    <span className="font-semibold text-slate-800 text-sm">{faq.question}</span>
                    {openId === faq.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-4" />
                    )}
                  </button>
                  {openId === faq.id && (
                    <div className="px-6 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      <p className="pt-3">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}