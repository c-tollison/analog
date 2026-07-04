import type { z } from 'zod';

type ApiErrorBody = { error: string };

export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

// Called when res.ok is false — parses the backend's { error: string } shape.
export async function throwApiError(res: Response): Promise<never> {
    const body: ApiErrorBody = await res
        .json()
        .catch(() => ({ error: 'Something went wrong' }));
    throw new ApiError(body.error ?? 'Something went wrong', res.status);
}

// Safe display-ready message from anything thrown.
export function getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Something went wrong';
}

// Extracts the first error message per field path from Zod issues.
export function parseZodErrors(
    issues: z.core.$ZodIssue[]
): Record<string, string> {
    return issues.reduce<Record<string, string>>((acc, issue) => {
        const key = issue.path[0];
        if (typeof key === 'string' && !Object.hasOwn(acc, key)) {
            acc[key] = issue.message;
        }
        return acc;
    }, {});
}
