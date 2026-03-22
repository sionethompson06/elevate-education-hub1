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
        backgroundColor: imageUrl ? undefined : "#1a3c5e",
      }}
    >
      {overlay && imageUrl && (
        <div className="absolute inset-0 bg-[#1a3c5e]/75" />
      )}
      {!imageUrl && <div className="absolute inset-0 bg-gradient-to-br from-[#1a3c5e] to-[#0d2540]" />}
      <div className="relative max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">{headline}</h1>
        {subheadline && (
          <p className="text-slate-200 text-lg mb-8 max-w-2xl mx-auto">{subheadline}</p>
        )}
        {ctaLabel && ctaHref && (
          <Link to={ctaHref}>
            <Button size="lg" className="bg-yellow-400 text-[#1a3c5e] hover:bg-yellow-300 font-bold">
              {ctaLabel} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        )}
      </div>
    </section>
  );
}