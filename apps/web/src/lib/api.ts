import { type ClientResponse, hcWithType } from '@analog/api/client';
import { ApiErrorResponseSchema, GENERIC_ERROR_MESSAGE } from '@analog/types';

import { reportUnauthorized } from './auth';
import { API_URL } from './env';

export const NETWORK_ERROR_STATUS = 0;
const UNAUTHORIZED_STATUS = 401;

export type ApiClient = ReturnType<typeof hcWithType>['api'];

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

const wrappedFetch: typeof fetch = async (input, init) => {
    try {
        const res = await fetch(input, { ...init, credentials: 'include' });
        if (res.status === UNAUTHORIZED_STATUS) {
            reportUnauthorized();
        }
        return res;
    } catch {
        throw new ApiError(
            'Unable to reach the server. Check your connection and try again.',
            NETWORK_ERROR_STATUS
        );
    }
};

/** The typed API client. Wrap calls in `unwrap` to get the body or throw. */
export const api: ApiClient = hcWithType(API_URL, { fetch: wrappedFetch }).api;

/** Pulls the `{ error }` message out of a failed API response. */
export async function readApiError(
    res: Pick<Response, 'json'>
): Promise<string> {
    try {
        const parsed = ApiErrorResponseSchema.safeParse(await res.json());
        return parsed.success ? parsed.data.error : GENERIC_ERROR_MESSAGE;
    } catch {
        return GENERIC_ERROR_MESSAGE;
    }
}

const NO_CONTENT_STATUS = 204;

/**
 * The body a typed client response resolves to on success: JSON, text, or
 * nothing. Error responses are dropped since unwrap throws for them.
 */
export type ResponseData<R> = R extends { ok: false }
    ? never
    : R extends ClientResponse<infer T, number, infer F>
      ? F extends 'json' | 'text'
          ? T
          : undefined
      : never;

/**
 * The body of a successful response (parsed JSON, text, or undefined for
 * 204), or throws ApiError.
 *
 *     unwrap(await api.collections[':id'].$get({ param: { id } }))
 */
export async function unwrap<R extends ClientResponse<unknown>>(
    res: R
): Promise<ResponseData<R>> {
    if (!res.ok) {
        throw new ApiError(await readApiError(res), res.status);
    }
    if (res.status === NO_CONTENT_STATUS) {
        return undefined as ResponseData<R>;
    }
    const isJson = res.headers
        .get('content-type')
        ?.includes('application/json');
    return (await (isJson ? res.json() : res.text())) as ResponseData<R>;
}
