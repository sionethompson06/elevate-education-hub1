import { useState } from "react";
import { apiPost } from "@/api/apiClient";
import { Mail, Phone, MapPin, CheckCircle } from "lucide-react";

const CONTACT_ITEMS = [
  {
    icon: Mail,
    color: "#3B82F6",
    label: "Email",
    value: "admissions@elevateperformance-academy.com",
    href: "mailto:admissions@elevateperformance-academy.com",
  },
  {
    icon: Phone,
    color: "#10B981",
    label: "Phone",
    value: "808-383-7519",
    href: "tel:8083837519",
  },
  {
    icon: MapPin,
    color: "#8B5CF6",
    label: "Serving",
    value: "Oregon, Nevada, California, Hawaii, and more",
    href: null,
  },
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await apiPost("/contact", { name: form.name.trim(), email: form.email.trim(), message: form.message.trim() });
      setSent(true);
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setError(err.message || "Could not send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#0A0F1A]">
      {/* Hero */}
      <section className="py-20 px-6 text-white border-b border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono tracking-widest text-[#3B82F6] uppercase mb-4">GET IN TOUCH</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            WE'D LOVE TO <span className="text-[#10B981]">HEAR FROM YOU</span>
          </h1>
          <p className="text-slate-400">Our admissions team is ready to answer your questions.</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          {/* Contact info */}
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Contact Information</h2>
            <div className="space-y-4">
              {CONTACT_ITEMS.map(({ icon: Icon, color, label, value, href }) => (
                <div key={label} className="bg-[#1E293B] border border-white/5 rounded-xl p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs font-mono tracking-widest text-slate-500 uppercase mb-0.5">{label}</p>
                    {href ? (
                      <a href={href} className="text-sm text-slate-300 hover:text-white transition-colors">{value}</a>
                    ) : (
                      <p className="text-sm text-slate-300">{value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-[#1E293B] border border-white/5 rounded-2xl p-8">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6">Send a Message</h3>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <CheckCircle className="w-10 h-10 text-[#10B981]" />
                <p className="font-black text-white uppercase tracking-tight">MESSAGE SENT</p>
                <p className="text-sm text-slate-400">We'll get back to you within 24 hours.</p>
                <button onClick={() => setSent(false)} className="mt-2 text-xs text-[#10B981] hover:underline">
                  Send another message
                </button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs font-mono tracking-widest text-slate-500 uppercase block mb-1.5">Full Name</label>
                  <input
                    className="w-full bg-[#0A0F1A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#3B82F6]/50"
                    placeholder="Your name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-mono tracking-widest text-slate-500 uppercase block mb-1.5">Email</label>
                  <input
                    type="email"
                    className="w-full bg-[#0A0F1A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#3B82F6]/50"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-mono tracking-widest text-slate-500 uppercase block mb-1.5">Message</label>
                  <textarea
                    className="w-full bg-[#0A0F1A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#3B82F6]/50 resize-none h-28"
                    placeholder="How can we help?"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 uppercase tracking-wide"
                >
                  {sending ? "Sending…" : "SEND MESSAGE"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
