import { z } from 'zod';

const fieldTypeEnum = z.enum([
  'TEXT', 'TEXTAREA', 'NUMBER', 'DECIMAL', 'DATE', 'DATETIME',
  'URL', 'CHECKBOX', 'SELECT', 'MULTI_SELECT', 'USER', 'LABEL',
]);

const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const createCustomFieldDto = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  fieldType: fieldTypeEnum,
  options: z.array(selectOptionSchema).optional(),
});

export const updateCustomFieldDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  options: z.array(selectOptionSchema).optional(),
});

export const reorderCustomFieldsDto = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    orderIndex: z.number().int().nonnegative(),
  })).min(1),
});

export type CreateCustomFieldDto = z.infer<typeof createCustomFieldDto>;
export type UpdateCustomFieldDto = z.infer<typeof updateCustomFieldDto>;
export type ReorderCustomFieldsDto = z.infer<typeof reorderCustomFieldsDto>;
