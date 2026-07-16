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
  subheadline = "Kincaid Health exposes hidden financial risk inside PBM contracts.",
  badgeText,
  primaryCta = "Start free trial",
  secondaryCta,
  onPrimary,
  onSecondary,
}: HeroProps) {
  const split = Math.ceil(headline.split(" ").length / 2);
  const line1 = headline.split(" ").slice(0, split).join(" ");
  const line2 = headline.split(" ").slice(split).join(" ");

  return (
    <div className="kiq-public-hero px-6">
      <div className="relative mx-auto max-w-4xl">
        {badgeText && (
          <div className="kiq-public-badge mb-6">
            {badgeText}
          </div>
        )}

        <h1 className="kiq-public-title mb-6">
          {line1}
          <br />
          <span className="kiq-public-gradient-text">{line2}</span>
        </h1>

        <p className="kiq-public-lead mx-auto mb-10 max-w-2xl">
          {subheadline}
        </p>

        {(onPrimary || onSecondary) && (
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {onPrimary && (
              <Button
                size="lg"
                className="gap-2 px-8 text-base"
                onClick={onPrimary}
              >
                {primaryCta} <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            {onSecondary && secondaryCta && (
              <Button
                size="lg"
                variant="outline"
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
