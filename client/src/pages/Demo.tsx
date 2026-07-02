import { useLocation } from "wouter";
import Hero from "@/components/Hero";
import CommandCenter from "@/components/CommandCenter";

export default function Demo() {
  const [, setLocation] = useLocation();

  return (
    <main className="kiq-command-bg min-h-screen text-white">
      <Hero
        headline="The Intelligence Layer Beneath Healthcare"
        subheadline="Kincaid IQ exposes hidden financial risk inside PBM contracts."
        badgeText="Contract X-Ray Demo"
        primaryCta="Get full access"
        secondaryCta="Sign in"
        onPrimary={() => setLocation("/signup")}
        onSecondary={() => setLocation("/login")}
      />
      <CommandCenter />
    </main>
  );
}
