import { z } from 'zod';

/** A route param `:id` holding a uuid. */
export const IdParamSchema = z.object({ id: z.uuid('Invalid id') });
