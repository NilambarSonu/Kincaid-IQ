import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

// Helper to safely parse Zod schemas
function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    queryFn: async () => {
      const res = await fetch(api.logs.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transparency logs");
      const data = await res.json();
      return parseWithLogging(api.logs.list.responses[200], data, "logs.list");
    },
  });
}

export function useSubmitPrompt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (prompt: string) => {
      const payload = { prompt };
      const validatedPayload = api.logs.create.input.parse(payload);

      const res = await fetch(api.logs.create.path, {
        method: api.logs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedPayload),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to process prompt through AI engines");
      }

      const data = await res.json();
      return parseWithLogging(api.logs.create.responses[201], data, "logs.create");
    },
    onSuccess: () => {
      // Invalidate the logs list so the transparency page updates immediately
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
    },
  });
}
