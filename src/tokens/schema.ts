import { z } from 'zod';

export const TokenAttributeSchema = z.object({
  category: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
});

export const TokenValueSchema = z.union([
  z.string(),
  z.number(),
  z.object({
    value: z.union([z.string(), z.number()]),
    formula: z.string().optional(),
    attributes: TokenAttributeSchema.optional(),
  }),
]);

export const TokenSchema = z.record(z.string(), TokenValueSchema);

export type TokenFile = z.infer<typeof TokenSchema>;
