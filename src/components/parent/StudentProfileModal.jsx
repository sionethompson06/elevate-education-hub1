import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiPut, apiDelete } from "@/api/apiClient";
import { X, Save, Loader2, Plus, Trash2, Phone, User, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const TABS = [
  { id: "info",      label: "Student Info",        icon: User },
  { id: "emergency", label: "Emergency Contacts",   icon: Phone },
  { id: "medical",   label: "Medical Info",         icon: Stethoscope },
  { id: "guardians", label: "Guardians",            icon: Users },
];

const GRADE_OPTIONS = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const RELATIONSHIP_OPTIONS = [
  "parent", "guardian", "grandparent", "aunt/uncle", "sibling", "step-parent", "foster parent", "other",
];

// ── Student Info Tab ────────────────────────────────────────────────────────

function StudentInfoTab({ student, onUpdated, toast }) {
  const [form, setForm] = useState({
    firstName: student.firstName || "",
    lastName:  student.lastName  || "",
    dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split("T")[0] : "",
    grade:     student.grade     || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName.trim()) { toast({ title: "First name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apiPatch(`/students/${student.id}/my-student`, form);
      toast({ title: "Student info updated" });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">First Name *</label>
          <input
            value={form.firstName}
            onChange={e => set("firstName", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name</label>
          <input
            value={form.lastName}
            onChange={e => set("lastName", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={e => set("dateOfBirth", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Grade</label>
          <select
            value={form.grade}
            onChange={e => set("grade", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white"
          >
            <option value="">— Select grade —</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ── Emergency Contacts Tab ───────────────────────────────────────────────────

function EmergencyContactsTab({ student, toast }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", relationship: "parent", phone: "", isAuthorizedPickup: false });
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["emergency-contacts", student.id],
    queryFn: () => apiGet(`/students/${student.id}/emergency-contacts`),
  });
  const contacts = data?.emergencyContacts || [];

  const resetForm = () => {
    setForm({ name: "", relationship: "parent", phone: "", isAuthorizedPickup: false });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (c) => {
    setForm({ name: c.name, relationship: c.relationship, phone: c.phone, isAuthorizedPickup: c.isAuthorizedPickup });
    setEditingId(c.id);
    setAdding(false);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Name and phone are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiPatch(`/students/${student.id}/emergency-contacts/${editingId}`, form);
        toast({ title: "Contact updated" });
      } else {
        await apiPost(`/students/${student.id}/emergency-contacts`, form);
        toast({ title: "Contact added" });
      }
      resetForm();
      refetch();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await apiDelete(`/students/${student.id}/emergency-contacts/${id}`);
      toast({ title: "Contact removed" });
      refetch();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const ContactForm = () => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase">{editingId ? "Edit Contact" : "New Contact"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
          <input value={form.name} onChange={e => setField("name", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Phone *</label>
          <input value={form.phone} onChange={e => setField("phone", e.target.value)}
            placeholder="(555) 000-0000"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Relationship</label>
        <select value={form.relationship} onChange={e => setField("relationship", e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 bg-white">
          {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isAuthorizedPickup}
          onChange={e => setField("isAuthorizedPickup", e.target.checked)} className="accent-[#1a3c5e]" />
        <span className="text-sm text-slate-700">Authorized for pickup</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={resetForm} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#1a3c5e] hover:bg-[#0d2540]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Update" : "Add Contact")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
      ) : contacts.length === 0 && !adding ? (
        <p className="text-sm text-slate-400 text-center py-4">No emergency contacts on file.</p>
      ) : (
        contacts.map(c => (
          editingId === c.id ? <ContactForm key={c.id} /> :
          <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                {c.isAuthorizedPickup && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> Pickup
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{c.relationship} · {c.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(c)} className="text-xs text-[#1a3c5e] hover:underline">Edit</button>
              <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
      {adding && !editingId && <ContactForm />}
      {!adding && !editingId && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-[#1a3c5e] hover:text-[#1a3c5e] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Emergency Contact
        </button>
      )}
    </div>
  );
}

// ── Medical Info Tab ────────────────────────────────────────────────────────

function MedicalInfoTab({ student, toast }) {
  const { data, isLoading } = useQuery({
    queryKey: ["medical-info", student.id],
    queryFn: () => apiGet(`/students/${student.id}/medical-info`),
  });

  const existing = data?.medicalInfo;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Initialize form from fetched data (once loaded)
  const currentForm = form ?? (existing ? {
    allergies: existing.allergies || "",
    medications: existing.medications || "",
    medicalConditions: existing.medicalConditions || "",
    doctorName: existing.doctorName || "",
    doctorPhone: existing.doctorPhone || "",
    insuranceCarrier: existing.insuranceCarrier || "",
    insurancePolicyNumber: existing.insurancePolicyNumber || "",
    notes: existing.notes || "",
  } : {
    allergies: "", medications: "", medicalConditions: "",
    doctorName: "", doctorPhone: "", insuranceCarrier: "", insurancePolicyNumber: "", notes: "",
  });

  const set = (k, v) => setForm(f => ({ ...(f ?? currentForm), [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut(`/students/${student.id}/medical-info`, currentForm);
      toast({ title: "Medical info saved" });
      setForm(null); // reset to server state on next fetch
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (isLoading) return <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Allergies</label>
        <textarea rows={2} value={currentForm.allergies} onChange={e => set("allergies", e.target.value)}
          placeholder="List any known allergies..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Current Medications</label>
        <textarea rows={2} value={currentForm.medications} onChange={e => set("medications", e.target.value)}
          placeholder="List any medications..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Medical Conditions</label>
        <textarea rows={2} value={currentForm.medicalConditions} onChange={e => set("medicalConditions", e.target.value)}
          placeholder="Any conditions staff should be aware of..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor / Physician</label>
          <input value={currentForm.doctorName} onChange={e => set("doctorName", e.target.value)}
            placeholder="Dr. Name"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor Phone</label>
          <input value={currentForm.doctorPhone} onChange={e => set("doctorPhone", e.target.value)}
            placeholder="(555) 000-0000"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Insurance Carrier</label>
          <input value={currentForm.insuranceCarrier} onChange={e => set("insuranceCarrier", e.target.value)}
            placeholder="Insurance company name"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Policy Number</label>
          <input value={currentForm.insurancePolicyNumber} onChange={e => set("insurancePolicyNumber", e.target.value)}
            placeholder="Policy #"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Additional Notes</label>
        <textarea rows={2} value={currentForm.notes} onChange={e => set("notes", e.target.value)}
          placeholder="Any other information staff should know..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/30 resize-none" />
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="bg-[#1a3c5e] hover:bg-[#0d2540]">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Medical Info
        </Button>
      </div>
    </div>
  );
}

// ── Guardians Tab ────────────────────────────────────────────────────────────

function GuardiansTab({ student, toast }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-guardians", student.id],
    queryFn: () => apiGet(`/students/${student.id}/guardians`),
  });
  const guardians = data?.guardians || [];

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" /></div>
      ) : guardians.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No other guardians on file.</p>
      ) : (
        guardians.map(g => (
          <div key={g.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{g.firstName} {g.lastName}</p>
                {g.isPrimary && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Primary</span>
                )}
              </div>
              <p className="text-xs text-slate-500">{g.email} · {g.relationship}</p>
            </div>
          </div>
        ))
      )}
      <p className="text-xs text-slate-400 text-center pt-1">
        To add or remove guardians, please contact the academy office.
      </p>
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────

export default function StudentProfileModal({ student, onClose, onUpdated }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");

  const studentName = `${student.firstName} ${student.lastName}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1a3c5e] flex items-center justify-center text-white font-bold text-sm">
              {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-[#1a3c5e] text-lg leading-tight">{studentName}</h2>
              {student.grade && <p className="text-xs text-slate-400">Grade {student.grade}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-[#1a3c5e] text-[#1a3c5e]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {activeTab === "info"      && <StudentInfoTab       student={student} onUpdated={onUpdated} toast={toast} />}
          {activeTab === "emergency" && <EmergencyContactsTab student={student} toast={toast} />}
          {activeTab === "medical"   && <MedicalInfoTab       student={student} toast={toast} />}
          {activeTab === "guardians" && <GuardiansTab         student={student} toast={toast} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t shrink-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
