import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/api/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import CmsEditModal from "./CmsEditModal";

export default function CmsEntityTable({ entityName }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ["cms-all"],
    queryFn: () => apiGet('/cms'),
  });

  // Filter by section matching entityName tab
  const sectionMap = {
    CmsPage: "pages",
    CmsProgram: "programs",
    CmsPricingPlan: "pricing",
    CmsFaqItem: "faq",
    CmsPolicySection: "policy",
  };
  const section = sectionMap[entityName] || entityName.toLowerCase();
  const records = allRecords.filter(r => r.section === section);

  const handleSave = async (data) => {
    const key = editing === "new" ? data.key : editing.key;
    await apiPut(`/cms/${key}`, { title: data.title, body: data.body, section });
    qc.invalidateQueries({ queryKey: ["cms-all"] });
    setEditing(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">{records.length} records</p>
        <Button onClick={() => setEditing("new")} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
          + New Record
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <p className="text-center text-slate-400 py-12 text-sm">No records yet. Create your first one.</p>
          ) : (
            <div className="divide-y">
              {records.map((record) => (
                <div key={record.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{record.title || record.key}</p>
                    <p className="text-xs text-slate-400 truncate font-mono">/{record.key}</p>
                    {record.updatedAt && (
                      <p className="text-xs text-slate-300 mt-0.5">
                        Updated {format(new Date(record.updatedAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(record)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing !== null && (
        <CmsEditModal
          record={editing === "new" ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
