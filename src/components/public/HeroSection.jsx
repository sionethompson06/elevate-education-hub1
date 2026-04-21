import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function HeroSection({ headline, subheadline, ctaLabel, ctaHref, imageUrl, overlay = true }) {
  return (
    <section
      className="relative py-24 px-6 text-white"
      style={{
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: imageUrl ? undefined : "#0A0F1A",
      }}
    >
      {overlay && imageUrl && (
        <div className="absolute inset-0 bg-[#0A0F1A]/80" />
      )}
      {!imageUrl && <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1A] to-[#0D1117]" />}
      <div className="relative max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight uppercase tracking-tight">{headline}</h1>
        {subheadline && (
          <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">{subheadline}</p>
        )}
        {ctaLabel && ctaHref && (
          <Link to={ctaHref}>
            <Button size="lg" className="bg-[#10B981] text-white hover:bg-[#059669] font-bold">
              {ctaLabel} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        )}
      </div>
    </section>
  );
}
