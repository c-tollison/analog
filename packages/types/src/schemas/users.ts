import { z } from 'zod';

export const CreateUserRequestSchema = z.object({
    name: z.string().trim().min(1).max(255),
});

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
