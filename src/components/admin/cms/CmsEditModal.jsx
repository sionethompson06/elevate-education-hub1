import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

export default function CmsEditModal({ record, onSave, onClose, isSaving }) {
  const [form, setForm] = useState({ key: "", title: "", body: "" });

  useEffect(() => {
    if (record) {
      setForm({ key: record.key || "", title: record.title || "", body: record.body || "" });
    } else {
      setForm({ key: "", title: "", body: "" });
    }
  }, [record]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-[#1a3c5e] text-lg">
            {record ? "Edit Content" : "New Content"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key <span className="text-red-500">*</span></label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.key}
              onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
              placeholder="e.g. home-hero"
              required
              disabled={!!record}
            />
            <p className="text-xs text-slate-400 mt-1">Used as the URL-safe identifier. Cannot be changed after creation.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Display title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Body / Content</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 min-h-[160px] font-mono"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Content body (supports Markdown)"
            />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
