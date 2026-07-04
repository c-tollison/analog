import type { CreateUserRequest } from '@analog/types';
import { useMutation } from '@tanstack/react-query';

import { client } from '@/lib/api';
import { throwApiError } from '@/lib/errors';

export function useCreateUserMutation() {
    return useMutation({
        mutationFn: async (data: CreateUserRequest) => {
            const res = await client.api.users.$post({ json: data });
            if (!res.ok) return throwApiError(res);
            return res.json();
        },
    });
}
