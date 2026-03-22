import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

const FIELD_CONFIGS = {
  CmsPage: [
    { key: "slug", label: "Slug", type: "text", required: true },
    { key: "title", label: "Title", type: "text", required: true },
    { key: "hero_headline", label: "Hero Headline", type: "text" },
    { key: "hero_subheadline", label: "Hero Subheadline", type: "text" },
    { key: "hero_cta_label", label: "CTA Label", type: "text" },
    { key: "hero_cta_href", label: "CTA Link", type: "text" },
    { key: "hero_image_url", label: "Hero Image URL", type: "text" },
    { key: "body_content", label: "Body Content (Markdown)", type: "textarea" },
    { key: "meta_title", label: "Meta Title", type: "text" },
    { key: "meta_description", label: "Meta Description", type: "textarea" },
    { key: "status", label: "Status", type: "select", options: ["draft", "published", "archived"] },
  ],
  CmsProgram: [
    { key: "slug", label: "Slug", type: "text", required: true },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "category", label: "Category", type: "select", options: ["academic", "athletic", "virtual_homeschool", "college_nil", "combined"], required: true },
    { key: "tagline", label: "Tagline", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "who_its_for", label: "Who It's For", type: "textarea" },
    { key: "outcomes", label: "Outcomes", type: "textarea" },
    { key: "cta_label", label: "CTA Label", type: "text" },
    { key: "cta_href", label: "CTA Link", type: "text" },
    { key: "hero_image_url", label: "Hero Image URL", type: "text" },
    { key: "sort_order", label: "Sort Order", type: "number" },
    { key: "status", label: "Status", type: "select", options: ["draft", "published", "archived"] },
  ],
  CmsPricingPlan: [
    { key: "name", label: "Plan Name", type: "text", required: true },
    { key: "program_slug", label: "Program Slug", type: "text" },
    { key: "price_monthly", label: "Monthly Price ($)", type: "number" },
    { key: "price_annual", label: "Annual Price ($)", type: "number" },
    { key: "billing_note", label: "Billing Note", type: "text" },
    { key: "badge_label", label: "Badge Label (e.g. Most Popular)", type: "text" },
    { key: "cta_label", label: "CTA Label", type: "text" },
    { key: "cta_href", label: "CTA Link", type: "text" },
    { key: "is_featured", label: "Featured Plan", type: "boolean" },
    { key: "sort_order", label: "Sort Order", type: "number" },
    { key: "status", label: "Status", type: "select", options: ["draft", "published", "archived"] },
  ],
  CmsFaqItem: [
    { key: "question", label: "Question", type: "text", required: true },
    { key: "answer", label: "Answer", type: "textarea", required: true },
    { key: "category", label: "Category", type: "text" },
    { key: "sort_order", label: "Sort Order", type: "number" },
    { key: "status", label: "Status", type: "select", options: ["draft", "published", "archived"] },
  ],
  CmsPolicySection: [
    { key: "policy_slug", label: "Policy Slug (e.g. cancellation-policy)", type: "text", required: true },
    { key: "section_title", label: "Section Title", type: "text", required: true },
    { key: "body", label: "Body (Markdown)", type: "textarea" },
    { key: "sort_order", label: "Sort Order", type: "number" },
    { key: "status", label: "Status", type: "select", options: ["draft", "published", "archived"] },
  ],
};

export default function CmsEditModal({ entityName, record, onSave, onClose, isSaving }) {
  const fields = FIELD_CONFIGS[entityName] || [];
  const [form, setForm] = useState({});

  useEffect(() => {
    if (record) {
      const initial = {};
      fields.forEach(({ key }) => { initial[key] = record[key] ?? ""; });
      setForm(initial);
    } else {
      const initial = {};
      fields.forEach(({ key, type }) => {
        initial[key] = type === "boolean" ? false : type === "number" ? 0 : type === "select" ? "draft" : "";
      });
      setForm(initial);
    }
  }, [record, entityName]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = { ...form };
    fields.forEach(({ key, type }) => {
      if (type === "number") clean[key] = Number(clean[key]) || 0;
      if (type === "boolean") clean[key] = Boolean(clean[key]);
    });
    onSave(clean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-[#1a3c5e] text-lg">
            {record ? "Edit Record" : "New Record"} — {entityName}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {fields.map(({ key, label, type, options, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
              </label>
              {type === "textarea" ? (
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[80px]"
                  value={form[key] || ""}
                  onChange={(e) => set(key, e.target.value)}
                  required={required}
                />
              ) : type === "select" ? (
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
                  value={form[key] || ""}
                  onChange={(e) => set(key, e.target.value)}
                  required={required}
                >
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : type === "boolean" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={key}
                    checked={!!form[key]}
                    onChange={(e) => set(key, e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor={key} className="text-sm text-slate-600">{label}</label>
                </div>
              ) : (
                <input
                  type={type === "number" ? "number" : "text"}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
                  value={form[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  required={required}
                />
              )}
            </div>
          ))}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-[#1a3c5e] hover:bg-[#0d2540]"
          >
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}