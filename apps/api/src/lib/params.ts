import { USERNAME_MAX_LENGTH } from '@analog/types';

import { z } from 'zod';

/** A route param `:id` holding a uuid. */
export const IdParamSchema = z.object({ id: z.uuid('Invalid id') });

/** A route param `:username`, matched without case. */
export const UsernameParamSchema = z.object({
    username: z.string().trim().toLowerCase().min(1).max(USERNAME_MAX_LENGTH),
});
