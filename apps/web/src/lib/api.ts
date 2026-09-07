import { hcWithType } from '@analog/api/client';

import { type InjectionKey, inject } from 'vue';

export const NETWORK_ERROR_STATUS = 0;

export type ApiClient = ReturnType<typeof hcWithType>['api'];

export interface ApiClientOptions {
    /** Origin of the API, e.g. `http://localhost:3001`. */
    baseUrl: string;
}

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export function createApiClient({ baseUrl }: ApiClientOptions): ApiClient {
    const wrappedFetch: typeof fetch = async (input, init) => {
        try {
            return await fetch(input, init);
        } catch {
            throw new ApiError(
                'Unable to reach the server. Check your connection and try again.',
                NETWORK_ERROR_STATUS
            );
        }
    };

    return hcWithType(baseUrl, { fetch: wrappedFetch }).api;
}

export const API_CLIENT_KEY: InjectionKey<ApiClient> =
    Symbol('analog-api-client');

export function useApiClient(): ApiClient {
    const api = inject(API_CLIENT_KEY);
    if (!api) {
        throw new Error(
            'No API client provided — call app.provide(API_CLIENT_KEY, createApiClient({ … })) at startup'
        );
    }
    return api;
}
