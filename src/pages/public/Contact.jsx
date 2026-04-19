import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import HeroSection from "@/components/public/HeroSection";
import CmsContent from "@/components/public/CmsContent";
import { Mail, Phone, Clock, CheckCircle } from "lucide-react";

export default function Contact() {
  const { data: allCms = [] } = useQuery({
    queryKey: ["cms-all-public"],
    queryFn: () => apiGet('/cms'),
  });

  const page = allCms.find(r => r.section === "pages" && r.key === "contact");

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
    <div>
      <HeroSection
        headline={page?.title || "We'd Love to Hear From You"}
        subheadline={page?.body || "Our team is here to help."}
      />

      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold text-[#1a3c5e] mb-6">Contact Information</h2>
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#1a3c5e] mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Email</p>
                  <a href="mailto:info@elevateperformanceacademy.com" className="text-sm text-[#1a3c5e] hover:underline">
                    info@elevateperformanceacademy.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#1a3c5e] mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Phone</p>
                  <p className="text-sm text-slate-600">(555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#1a3c5e] mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Hours</p>
                  <p className="text-sm text-slate-600">Monday–Friday, 8am–6pm PT</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Send a Message</h3>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <CheckCircle className="w-10 h-10 text-green-500" />
                <p className="font-semibold text-slate-800">Message sent!</p>
                <p className="text-sm text-slate-500">We'll get back to you within 1–2 business days.</p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-2 text-xs text-[#1a3c5e] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Name</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
                    placeholder="Your name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Message</label>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] resize-none h-28"
                    placeholder="How can we help?"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-[#1a3c5e] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#0d2540] transition-colors disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
