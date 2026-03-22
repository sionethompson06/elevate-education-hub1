import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import CmsContent from "@/components/public/CmsContent";

export default function CancellationPolicy() {
  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["cms-policy", "cancellation-policy"],
    queryFn: () => base44.entities.CmsPolicySection.filter({ policy_slug: "cancellation-policy", status: "published" }),
  });

  const sorted = [...sections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-[#1a3c5e] text-white py-16 px-6 text-center">
        <h1 className="text-4xl font-bold mb-3">Cancellation Policy</h1>
        <p className="text-slate-300 text-lg">Effective January 1, 2026</p>
      </div>

      <div className="max-w-3xl mx-auto py-16 px-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-slate-400 text-center py-12">Policy content not yet available.</p>
        ) : (
          <div className="space-y-10">
            {sorted.map((section) => (
              <div key={section.id}>
                <h2 className="text-xl font-bold text-[#1a3c5e] mb-4">{section.section_title}</h2>
                <div className="text-slate-600 leading-relaxed">
                  <CmsContent content={section.body} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}