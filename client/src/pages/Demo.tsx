import { useLocation } from "wouter";
import Hero from "@/components/Hero";
import CommandCenter from "@/components/CommandCenter";

export default function Demo() {
  const [, setLocation] = useLocation();

  return (
    <main className="kiq-public-shell min-h-screen">
      <div className="kiq-shell-ambient" aria-hidden="true" />
      <Hero
        headline="The Intelligence Layer Beneath Healthcare"
        subheadline="Kincaid Health exposes hidden financial risk inside PBM contracts."
        badgeText="Contract X-Ray Demo"
        primaryCta="Get full access"
        secondaryCta="Sign in"
        onPrimary={() => setLocation("/auth?mode=register")}
        onSecondary={() => setLocation("/auth")}
      />
      <CommandCenter />
    </main>
  );
}
