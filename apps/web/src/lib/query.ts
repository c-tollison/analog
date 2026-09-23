import { ApiError } from './api';
import { QueryClient } from '@tanstack/vue-query';

const MAX_RETRIES = 2;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) =>
                failureCount < MAX_RETRIES &&
                !(
                    error instanceof ApiError &&
                    error.status >= 400 &&
                    error.status < 500
                ),
        },
    },
});
