import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import HeroSection from "@/components/public/HeroSection";
import CmsContent from "@/components/public/CmsContent";
import { Mail, Phone, Clock } from "lucide-react";

export default function Contact() {
  const { data: pages = [] } = useQuery({
    queryKey: ["cms-page", "contact"],
    queryFn: () => base44.entities.CmsPage.filter({ slug: "contact", status: "published" }),
  });

  const page = pages[0];

  return (
    <div>
      <HeroSection
        headline={page?.hero_headline || "We'd Love to Hear From You"}
        subheadline={page?.hero_subheadline || "Our team is here to help."}
        imageUrl={page?.hero_image_url}
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

            {page?.body_content && (
              <div className="mt-8">
                <CmsContent content={page.body_content} />
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Send a Message</h3>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert("Contact form coming in Phase 4 (Admissions Workflow)."); }}>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Name</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
                <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" placeholder="your@email.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Message</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] resize-none h-28" placeholder="How can we help?" />
              </div>
              <button type="submit" className="w-full bg-[#1a3c5e] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#0d2540] transition-colors">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}