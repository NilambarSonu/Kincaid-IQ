import { useQuery } from "@tanstack/react-query";
import { usePersistentState } from "./use-persistent-state";
import {
  type DivergenceThresholds,
  type DivergenceWatchMap,
  DEFAULT_DIVERGENCE_THRESHOLDS,
  DIVERGENCE_THRESHOLDS_KEY,
} from "@/lib/divergence";

// Shared accessor for the per-EIN "fees rising at rank" watch payload + the
// broker's tuned thresholds. Consumed by both Benefits Benchmarking rows and the
// Broker Console prospect lists so every surface flags the same way.
export function useDivergenceWatch() {
  const [thresholds] = usePersistentState<DivergenceThresholds>(
    DIVERGENCE_THRESHOLDS_KEY,
    DEFAULT_DIVERGENCE_THRESHOLDS,
  );
  const query = useQuery<DivergenceWatchMap>({
    queryKey: ["/api/benchmark/divergence-watch"],
  });
  return { divergenceWatch: query.data ?? {}, thresholds };
}
