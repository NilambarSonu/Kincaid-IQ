import { useCallback } from "react";
import { useLocation } from "wouter";

export type HandoffTarget =
  | "benchmarking"
  | "war-room"
  | "exec-war-room"
  | "broker-console"
  | "rx-defense"
  | "company-360"
  | "shady-broker"
  | "sales-os"
  | "stop-loss"
  | "network-iq"
  | "fiduciary-iq";

const TARGET_PATHS: Record<HandoffTarget, string> = {
  "benchmarking":   "/benefits-benchmarking",
  "war-room":       "/",
  "exec-war-room":  "/cfo-war-room",
  "broker-console": "/broker-prospects",
  "rx-defense":     "/rx-defense",
  "company-360":    "/company-360",
  "shady-broker":   "/shady-broker-index",
  "sales-os":       "/sales-os",
  "stop-loss":      "/stop-loss",
  "network-iq":     "/network-iq",
  "fiduciary-iq":   "/fiduciary-iq",
};

export function useCompanyHandoff() {
  const [, navigate] = useLocation();

  const sendTo = useCallback(
    (target: HandoffTarget, ein: string, company: string, extra?: Record<string, string>) => {
      const params = new URLSearchParams({ ein, company, ...(extra ?? {}) });
      navigate(`${TARGET_PATHS[target]}?${params.toString()}`);
    },
    [navigate],
  );

  // Navigate to an explicit backend-provided deep-link path, preserving the
  // EIN + company handoff context as query params (harmless when the path
  // already encodes the EIN, e.g. /sales-os/account/:ein).
  const sendToPath = useCallback(
    (path: string, ein: string, company: string, extra?: Record<string, string>) => {
      const params = new URLSearchParams({ ein, company, ...(extra ?? {}) });
      const sep = path.includes("?") ? "&" : "?";
      navigate(`${path}${sep}${params.toString()}`);
    },
    [navigate],
  );

  return { sendTo, sendToPath };
}

export function readHandoffParams(): { ein: string | null; company: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { ein: params.get("ein"), company: params.get("company") };
}
