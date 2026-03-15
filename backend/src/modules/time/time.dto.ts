import { z } from 'zod';

export const manualTimeDto = z.object({
  hours: z.number().positive().max(24),
  note: z.string().max(500).optional(),
  logDate: z.string().optional(), // ISO date string
  source: z.enum(['HUMAN', 'HUMAN_AI']).optional().default('HUMAN'),
});

export type ManualTimeDto = z.infer<typeof manualTimeDto>;
