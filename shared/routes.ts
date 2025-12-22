import { z } from 'zod';
import { insertGroupSchema, insertParticipantSchema, insertExpenseSchema, groups, participants, expenses } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  groups: {
    list: {
      method: 'GET' as const,
      path: '/api/groups',
      responses: {
        200: z.array(z.custom<typeof groups.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/groups',
      input: insertGroupSchema,
      responses: {
        201: z.custom<typeof groups.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/groups/:id',
      responses: {
        200: z.custom<typeof groups.$inferSelect & { participants: typeof participants.$inferSelect[]; expenses: (typeof expenses.$inferSelect & { paidBy?: typeof participants.$inferSelect })[] }>(),
        404: errorSchemas.notFound,
      },
    },
    settlements: {
      method: 'GET' as const,
      path: '/api/groups/:id/settlements',
      responses: {
        200: z.object({
          transactions: z.array(z.object({
            from: z.string(),
            to: z.string(),
            amount: z.number(),
            currency: z.string()
          }))
        }),
        404: errorSchemas.notFound,
      },
    }
  },
  participants: {
    create: {
      method: 'POST' as const,
      path: '/api/groups/:id/participants',
      input: insertParticipantSchema.omit({ groupId: true }), // groupId comes from URL
      responses: {
        201: z.custom<typeof participants.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  expenses: {
    create: {
      method: 'POST' as const,
      path: '/api/groups/:id/expenses',
      input: insertExpenseSchema.omit({ groupId: true }), // groupId comes from URL
      responses: {
        201: z.custom<typeof expenses.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/groups/:id/expenses',
      responses: {
        200: z.array(z.custom<typeof expenses.$inferSelect>()),
      },
    }
  }
};

// ============================================
// REQUIRED: buildUrl helper
// ============================================
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
