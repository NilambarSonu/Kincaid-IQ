import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
  headline?: string;
  subheadline?: string | ReactNode;
  badgeText?: string;
  primaryCta?: string;
  secondaryCta?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export default function Hero({
  headline = "The Intelligence Layer Beneath Healthcare",
  subheadline = "Kincaid IQ exposes hidden financial risk inside PBM contracts.",
  badgeText,
  primaryCta = "Start free trial",
  secondaryCta,
  onPrimary,
  onSecondary,
}: HeroProps) {
  const [first, ...rest] = headline.split(" ");
  const split = Math.ceil(headline.split(" ").length / 2);
  const line1 = headline.split(" ").slice(0, split).join(" ");
  const line2 = headline.split(" ").slice(split).join(" ");

  return (
    <div className="text-center py-20 px-6 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(155,28,46,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-4xl mx-auto">
        {badgeText && (
          <div
            className="inline-block mb-6 text-sm px-4 py-1.5 rounded-full"
            style={{
              background: "rgba(155,28,46,0.10)",
              color: "#e0475a",
              border: "1px solid rgba(155,28,46,0.20)",
            }}
          >
            {badgeText}
          </div>
        )}

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          {line1}
          <br />
          <span
            style={{
              background:
                "linear-gradient(90deg, #e0475a 0%, #ffffff 60%, #c8d8f0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {line2}
          </span>
        </h1>

        <p className="text-xl opacity-60 max-w-2xl mx-auto mb-10">
          {subheadline}
        </p>

        {(onPrimary || onSecondary) && (
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {onPrimary && (
              <Button
                size="lg"
                className="text-white gap-2 text-base px-8"
                style={{ background: "#9B1C2E" }}
                onClick={onPrimary}
              >
                {primaryCta} <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            {onSecondary && secondaryCta && (
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white/70 hover:bg-white/5"
                onClick={onSecondary}
              >
                {secondaryCta}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
