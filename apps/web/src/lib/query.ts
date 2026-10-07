import { ApiError } from './api';
import { QueryClient } from '@tanstack/vue-query';

const MAX_RETRIES = 2;
const THIRTY_MINUTES = 30 * 60_000;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            // Keeps pages in memory long enough that going back skips the spinner.
            gcTime: THIRTY_MINUTES,
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
