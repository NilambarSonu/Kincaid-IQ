import { useQuery } from "@tanstack/react-query";

export interface QuoteData {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  name: string;
  live: boolean;
}

async function fetchQuotes(): Promise<QuoteData[]> {
  const res = await fetch("/api/market/quotes");
  if (!res.ok) throw new Error("Failed to fetch quotes");
  const data = await res.json();
  return data.quotes as QuoteData[];
}

export function useMarketData() {
  return useQuery<QuoteData[]>({
    queryKey: ["/api/market/quotes"],
    queryFn: fetchQuotes,
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: 1,
  });
}
