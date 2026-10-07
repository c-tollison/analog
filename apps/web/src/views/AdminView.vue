<script setup lang="ts">
import { AddedSort, VerifiedFilter } from '@analog/types';
import AdminCheckRunsTable from '@/components/admin/AdminCheckRunsTable.vue';
import AdminItemsTable from '@/components/admin/AdminItemsTable.vue';
import AdminNamesTable from '@/components/admin/AdminNamesTable.vue';
import AdminSeriesTable from '@/components/admin/AdminSeriesTable.vue';
import SearchInput from '@/components/SearchInput.vue';
import { Badge } from '@/components/shadcn-components/badge';
import { Button } from '@/components/shadcn-components/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/shadcn-components/tabs';
import {
    adminListQuery,
    useAdminItems,
    useAdminSeriesList,
} from '@/composables/useAdmin';
import { useSearchTerm } from '@/composables/useSearchTerm';

import { PlusIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { z } from 'zod';

const Tab = {
    Series: 'series',
    Books: 'books',
    NoCover: 'no-cover',
    People: 'people',
    Publishers: 'publishers',
    Checks: 'checks',
} as const;

// Tabs that list names, which have nothing to verify.
const NAME_TABS: string[] = [Tab.People, Tab.Publishers];

const STATUS_LABELS: Record<VerifiedFilter, string> = {
    [VerifiedFilter.Unverified]: 'To verify',
    [VerifiedFilter.Verified]: 'Verified',
    [VerifiedFilter.All]: 'All',
};

// The list state lives in the URL, so going back from a book or series page
// returns to the same tab, filter, search and page. Status is only there once
// someone picks one, and then it stays until they pick another.
const ListStateSchema = z.object({
    tab: z.enum(Tab).catch(Tab.Series),
    status: z.enum(VerifiedFilter).optional().catch(undefined),
    sort: z.enum(AddedSort).catch(AddedSort.Newest),
    q: z.string().catch(''),
    page: z.coerce.number().int().min(1).catch(1),
});

type ListState = z.infer<typeof ListStateSchema>;

const DEFAULTS = ListStateSchema.parse({});
const KEYS = ['tab', 'sort', 'q', 'page'] as const;

// The queue shows what's left to verify, and a search looks through
// everything.
function defaultStatus(q: string): VerifiedFilter {
    return q ? VerifiedFilter.All : VerifiedFilter.Unverified;
}

const route = useRoute();
const router = useRouter();

const state = computed(() => ListStateSchema.parse(route.query));

function update(changes: Partial<ListState>) {
    const next = { ...state.value, ...changes };
    // Leave defaults out to keep the URL short.
    const query = Object.fromEntries(
        KEYS.filter((key) => next[key] !== DEFAULTS[key]).map((key) => [
            key,
            String(next[key]),
        ])
    );
    if (next.status) {
        query.status = next.status;
    }
    router.replace({ query });
}

const tab = computed({
    get: () => state.value.tab,
    set: (value) => update({ tab: value, page: 1 }),
});
const status = computed({
    get: () => state.value.status ?? defaultStatus(state.value.q),
    set: (value) => update({ status: value, page: 1 }),
});
const sort = computed({
    get: () => state.value.sort,
    set: (value) => update({ sort: value }),
});
const page = computed({
    get: () => state.value.page,
    set: (value) => update({ page: value }),
});

// Totals for the tab labels. Page one is the same request each table makes
// for its first page, so it's usually already loaded.
const firstPage = () =>
    adminListQuery(
        { q: state.value.q, status: status.value, sort: state.value.sort },
        1
    );
const { data: itemsPage } = useAdminItems(firstPage);
const { data: seriesPage } = useAdminSeriesList(firstPage);
// Missing covers have nothing to do with verifying, so this tab lists them all.
const { data: noCoverPage } = useAdminItems(() => ({
    ...adminListQuery(
        {
            q: state.value.q,
            status: VerifiedFilter.All,
            sort: state.value.sort,
        },
        1
    ),
    noCover: true,
}));

const search = ref(state.value.q);
const { term } = useSearchTerm(search);
watch(term, (q) => {
    if (q !== state.value.q) update({ q, page: 1 });
});
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-2">
            <h1 class="text-lg font-semibold">Admin dashboard</h1>
            <Button as-child variant="outline">
                <RouterLink :to="{ name: 'admin-lookup' }">
                    <PlusIcon />
                    Add to catalog
                </RouterLink>
            </Button>
        </div>

        <Tabs v-model="tab">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                <TabsList>
                    <TabsTrigger :value="Tab.Series">
                        Series
                        <Badge v-if="seriesPage" variant="secondary">
                            {{ seriesPage.total }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger :value="Tab.Books">
                        Books
                        <Badge v-if="itemsPage" variant="secondary">
                            {{ itemsPage.total }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger :value="Tab.NoCover">
                        No cover
                        <Badge v-if="noCoverPage" variant="secondary">
                            {{ noCoverPage.total }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger :value="Tab.People">People</TabsTrigger>
                    <TabsTrigger :value="Tab.Publishers">
                        Publishers
                    </TabsTrigger>
                    <TabsTrigger :value="Tab.Checks">Checks</TabsTrigger>
                </TabsList>
                <div v-if="tab !== Tab.Checks" class="flex flex-1 gap-2">
                    <SearchInput
                        v-model="search"
                        :placeholder="
                            NAME_TABS.includes(tab)
                                ? 'Search names'
                                : 'Search titles'
                        "
                    />
                    <Select
                        v-if="tab !== Tab.NoCover && !NAME_TABS.includes(tab)"
                        v-model="status"
                    >
                        <SelectTrigger
                            class="w-auto shrink-0"
                            aria-label="Show"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="(label, value) in STATUS_LABELS"
                                :key="value"
                                :value="value"
                            >
                                {{ label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <TabsContent :value="Tab.Books">
                <AdminItemsTable
                    v-model:page="page"
                    v-model:sort="sort"
                    :q="state.q"
                    :status="status"
                />
            </TabsContent>
            <TabsContent :value="Tab.NoCover">
                <AdminItemsTable
                    v-model:page="page"
                    v-model:sort="sort"
                    :q="state.q"
                    :status="VerifiedFilter.All"
                    no-cover
                />
            </TabsContent>
            <TabsContent :value="Tab.People">
                <AdminNamesTable
                    v-model:page="page"
                    v-model:sort="sort"
                    kind="people"
                    :q="state.q"
                />
            </TabsContent>
            <TabsContent :value="Tab.Publishers">
                <AdminNamesTable
                    v-model:page="page"
                    v-model:sort="sort"
                    kind="publishers"
                    :q="state.q"
                />
            </TabsContent>
            <TabsContent :value="Tab.Checks">
                <AdminCheckRunsTable v-model:page="page" v-model:sort="sort" />
            </TabsContent>
            <TabsContent :value="Tab.Series">
                <AdminSeriesTable
                    v-model:page="page"
                    v-model:sort="sort"
                    :q="state.q"
                    :status="status"
                />
            </TabsContent>
        </Tabs>
    </div>
</template>
