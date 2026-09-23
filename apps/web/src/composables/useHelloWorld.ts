import { api, unwrap } from '@/lib/api';

import { useQuery } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';

export function useHelloWorld(
    name: MaybeRefOrGetter<string>,
    enabled: MaybeRefOrGetter<boolean> = true
) {
    return useQuery({
        queryKey: () => ['hello-world', toValue(name)],
        queryFn: async () =>
            unwrap(
                await api['hello-world'].$get({
                    query: { name: toValue(name) },
                })
            ),
        enabled,
    });
}
