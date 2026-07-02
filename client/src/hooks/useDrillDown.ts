import { createContext, useContext } from "react";
import { DrillDownRoot, DrillNode } from "@/lib/drillDownData";

export interface DrillState {
  root: DrillDownRoot | null;
  path: DrillNode[];
  current: DrillDownRoot | DrillNode;
  isOpen: boolean;
}

export interface DrillDownContextValue {
  state: DrillState;
  open: (id: string) => void;
  drillInto: (node: DrillNode) => void;
  goBack: () => void;
  goToLevel: (level: number) => void;
  close: () => void;
}

export const DrillDownContext = createContext<DrillDownContextValue | null>(null);

export function useDrillDown(): DrillDownContextValue {
  const ctx = useContext(DrillDownContext);
  if (!ctx) throw new Error("useDrillDown must be used within DrillDownProvider");
  return ctx;
}
