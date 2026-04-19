import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { useState } from "react";
import HeroSection from "@/components/public/HeroSection";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function FAQ() {
  const [openId, setOpenId] = useState(null);

  const { data: allCms = [] } = useQuery({
    queryKey: ["cms-all-public"],
    queryFn: () => apiGet('/cms'),
  });

  const page = allCms.find(r => r.section === "pages" && r.key === "faq");
  const faqs = allCms.filter(r => r.section === "faq");

  return (
    <div>
      <HeroSection
        headline={page?.title || "Frequently Asked Questions"}
        subheadline={page?.body || "Find answers to the most common questions."}
      />

      <section className="py-16 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          {faqs.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No FAQ items found.</p>
          ) : (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <div key={faq.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  >
                    <span className="font-semibold text-slate-800 text-sm">{faq.title || faq.key}</span>
                    {openId === faq.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-4" />
                    )}
                  </button>
                  {openId === faq.id && (
                    <div className="px-6 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      <p className="pt-3">{faq.body}</p>
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
