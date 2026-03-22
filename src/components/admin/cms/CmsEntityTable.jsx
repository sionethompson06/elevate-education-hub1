import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Archive, Eye, EyeOff, Pencil } from "lucide-react";
import { format } from "date-fns";
import CmsEditModal from "./CmsEditModal";

const STATUS_CONFIG = {
  published: { label: "Published", color: "bg-green-100 text-green-700", icon: CheckCircle },
  draft: { label: "Draft", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  archived: { label: "Archived", color: "bg-slate-100 text-slate-500", icon: Archive },
};

const DISPLAY_FIELD = {
  CmsPage: (r) => r.title || r.slug,
  CmsProgram: (r) => r.name,
  CmsPricingPlan: (r) => r.name,
  CmsFaqItem: (r) => r.question,
  CmsPolicySection: (r) => `${r.policy_slug} — ${r.section_title}`,
};

const SUB_FIELD = {
  CmsPage: (r) => `/${r.slug}`,
  CmsProgram: (r) => r.category,
  CmsPricingPlan: (r) => r.program_slug ? `for: ${r.program_slug}` : "",
  CmsFaqItem: (r) => r.category || "",
  CmsPolicySection: (r) => `order: ${r.sort_order ?? 0}`,
};

export default function CmsEntityTable({ entityName }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | "new" | record

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["cms", entityName],
    queryFn: () => base44.entities[entityName].list("-updated_date", 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities[entityName].update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cms", entityName] }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities[entityName].create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cms", entityName] }); setEditing(null); },
  });

  const handlePublish = (record) => {
    updateMutation.mutate({
      id: record.id,
      data: {
        status: "published",
        published_at: new Date().toISOString(),
        last_edited_by: user?.email,
      },
    });
  };

  const handleUnpublish = (record) => {
    updateMutation.mutate({ id: record.id, data: { status: "draft", last_edited_by: user?.email } });
  };

  const handleArchive = (record) => {
    updateMutation.mutate({ id: record.id, data: { status: "archived", last_edited_by: user?.email } });
  };

  const handleSave = (data) => {
    if (editing === "new") {
      createMutation.mutate({ ...data, last_edited_by: user?.email, version: 1 });
    } else {
      updateMutation.mutate({
        id: editing.id,
        data: { ...data, last_edited_by: user?.email, version: (editing.version || 1) + 1 },
      });
      setEditing(null);
    }
  };

  const displayField = DISPLAY_FIELD[entityName] || ((r) => r.id);
  const subField = SUB_FIELD[entityName] || (() => "");

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
              {records.map((record) => {
                const sc = STATUS_CONFIG[record.status] || STATUS_CONFIG.draft;
                const Icon = sc.icon;
                return (
                  <div key={record.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{displayField(record)}</p>
                      <p className="text-xs text-slate-400 truncate">{subField(record)}</p>
                      {record.updated_date && (
                        <p className="text-xs text-slate-300 mt-0.5">
                          Updated {format(new Date(record.updated_date), "MMM d, yyyy")}
                          {record.last_edited_by ? ` · ${record.last_edited_by}` : ""}
                          {record.version ? ` · v${record.version}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
                        <Icon className="w-3 h-3" />
                        {sc.label}
                      </span>

                      <Button size="sm" variant="ghost" onClick={() => setEditing(record)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>

                      {record.status !== "published" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handlePublish(record)}
                          disabled={updateMutation.isPending}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Publish
                        </Button>
                      )}
                      {record.status === "published" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                          onClick={() => handleUnpublish(record)}
                          disabled={updateMutation.isPending}
                        >
                          <EyeOff className="w-3.5 h-3.5 mr-1" />
                          Unpublish
                        </Button>
                      )}
                      {record.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-red-500"
                          onClick={() => handleArchive(record)}
                          disabled={updateMutation.isPending}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {editing !== null && (
        <CmsEditModal
          entityName={entityName}
          record={editing === "new" ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </>
  );
}