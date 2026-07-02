import { z } from 'zod';
import { insertLogSchema, logs } from './schema';

export const api = {
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs' as const,
      responses: {
        200: z.array(z.custom<typeof logs.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/logs' as const,
      input: z.object({ prompt: z.string() }),
      responses: {
        201: z.array(z.custom<typeof logs.$inferSelect>()),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
