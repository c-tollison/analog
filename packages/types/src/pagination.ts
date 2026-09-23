import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const PageQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_PAGE_SIZE)
        .default(DEFAULT_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
});

export type PageQuery = z.output<typeof PageQuerySchema>;
