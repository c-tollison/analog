import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ZodType } from 'zod';

// Wraps zValidator so validation failures go through the error handler
// as { error: string } instead of Zod's raw format.
export function schemaValidator<
    Target extends keyof ValidationTargets,
    TSchema extends ZodType,
>(target: Target, schema: TSchema) {
    return zValidator(target, schema, (result, _c) => {
        if (!result.success) {
            const first = result.error.issues[0];
            throw new HTTPException(400, {
                message: first?.message ?? 'Invalid request',
            });
        }
    });
}
