import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import CmsContent from "@/components/public/CmsContent";

export default function CancellationPolicy() {
  const { data: allCms = [], isLoading } = useQuery({
    queryKey: ["cms-all-public"],
    queryFn: () => apiGet('/cms'),
  });

  const sections = allCms.filter(r => r.section === "policy");

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
        ) : sections.length === 0 ? (
          <p className="text-slate-400 text-center py-12">Policy content not yet available.</p>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => (
              <div key={section.id}>
                <h2 className="text-xl font-bold text-[#1a3c5e] mb-4">{section.title}</h2>
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
