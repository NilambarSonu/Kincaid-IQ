import { useQuery } from "@tanstack/react-query";

export interface SubscriptionAccess {
  plan: string;
  plan_display: { name: string; color: string; price: number };
  modules: string[];
  status: string;
  trial_ends_at: string | null;
  is_admin: boolean;
}

export const PLAN_HIERARCHY = ["trial", "fiduciary", "broker", "enterprise"];

export const PLAN_REQUIRED: Record<string, { plan: string; label: string; price: number }> = {
  "rx-defense":         { plan: "fiduciary",  label: "Plan Fiduciary",    price: 297 },
  "dol5500":            { plan: "fiduciary",  label: "Plan Fiduciary",    price: 297 },
  "stewardship":        { plan: "fiduciary",  label: "Plan Fiduciary",    price: 297 },
  "board-pack":         { plan: "fiduciary",  label: "Plan Fiduciary",    price: 297 },
  "proof-ledger":       { plan: "fiduciary",  label: "Plan Fiduciary",    price: 297 },
  "broker-iq":          { plan: "broker",     label: "Sales IQ Console", price: 79 },
  "rx-pbm":             { plan: "broker",     label: "RxPBM Intelligence", price: 99 },
  "actuarial-engine":   { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "prospecting":        { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "stop-loss":          { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "network-disruption": { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "claims-recovery":    { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "shadow-tax":         { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "zero-trust":         { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "cfo-war-room":       { plan: "broker",     label: "Sales IQ Console", price: 997 },
  "god-mode":           { plan: "enterprise", label: "Fiduciary Command",  price: 2497 },
  "sbi-forensic":       { plan: "enterprise", label: "Fiduciary Command",  price: 2497 },
  "cei-engine":         { plan: "enterprise", label: "Fiduciary Command",  price: 2497 },
  "glp1-stress-test":   { plan: "enterprise", label: "Fiduciary Command",  price: 2497 },
  "mckinsey-copilot":   { plan: "enterprise", label: "Fiduciary Command",  price: 2497 },
  "sms-center":         { plan: "enterprise", label: "Fiduciary Command",  price: 2497 },
  "rfp-intelligence":   { plan: "broker",     label: "Sales IQ Console",  price: 997 },
};

export function useSubscription() {
  const { data, isLoading, error } = useQuery<SubscriptionAccess>({
    queryKey: ["/api/billing/access"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // All paywalls removed — every module is freely accessible to all users.
  const canAccess = (_module: string): boolean => true;

  // All paywalls removed — no minimum plan is ever required.
  const hasMinPlan = (_minPlan: string): boolean => true;

  return { access: data, isLoading, error, canAccess, hasMinPlan };
}
