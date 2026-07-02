import { useState, useCallback, ReactNode } from "react";
import { DrillDownRoot, DrillNode, getDrillTree } from "@/lib/drillDownData";
import { DrillDownContext } from "@/hooks/useDrillDown";
import { DrillDownPanel } from "./DrillDownPanel";

export interface DrillState {
  root: DrillDownRoot | null;
  path: DrillNode[];
  isOpen: boolean;
}

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrillState>({
    root: null,
    path: [],
    isOpen: false,
  });

  const open = useCallback((id: string) => {
    const root = getDrillTree(id);
    if (!root) return;
    setState({ root, path: [], isOpen: true });
  }, []);

  const drillInto = useCallback((node: DrillNode) => {
    setState((prev) => ({ ...prev, path: [...prev.path, node] }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({ ...prev, path: prev.path.slice(0, -1) }));
  }, []);

  const goToLevel = useCallback((level: number) => {
    setState((prev) => ({ ...prev, path: prev.path.slice(0, level) }));
  }, []);

  const close = useCallback(() => {
    setState({ root: null, path: [], isOpen: false });
  }, []);

  const current: DrillDownRoot | DrillNode | null = state.path.length > 0
    ? state.path[state.path.length - 1]
    : state.root;

  const value = {
    state: { ...state, current: current! },
    open,
    drillInto,
    goBack,
    goToLevel,
    close,
  };

  return (
    <DrillDownContext.Provider value={value}>
      {children}
      <DrillDownPanel />
    </DrillDownContext.Provider>
  );
}
