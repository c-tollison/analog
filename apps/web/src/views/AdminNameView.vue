<script setup lang="ts">
import NamePicker from '@/components/admin/NamePicker.vue';
import BackButton from '@/components/BackButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import FormError from '@/components/FormError.vue';
import { Button } from '@/components/shadcn-components/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from '@/components/shadcn-components/item';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import {
    TagsInput,
    TagsInputInput,
    TagsInputItem,
    TagsInputItemDelete,
    TagsInputItemText,
} from '@/components/shadcn-components/tags-input';
import {
    type NameKind,
    useAdminName,
    useAdminPublisher,
    useMergeName,
    useSetParentPublisher,
    useUpdateName,
} from '@/composables/useAdmin';
import { useAppForm } from '@/composables/useAppForm';
import { usePageTitle } from '@/composables/usePageTitle';
import { NameFormSchema } from '@/lib/admin-schemas';
import { vNoAutofill } from '@/lib/no-autofill';

import { MergeIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

// One person or publisher: its name, the other spellings lookups match, what
// uses it, and merging it into another.
const props = defineProps<{ kind: NameKind; id: string }>();

const router = useRouter();

const { data: found, error: loadError } = useAdminName(
    props.kind,
    () => props.id
);
usePageTitle(() => found.value?.name);

const update = useUpdateName(props.kind);
const merge = useMergeName(props.kind);
const setParent = useSetParentPublisher();
// Publishers can be imprints of another.
const { data: imprintInfo } = useAdminPublisher(
    () => props.id,
    () => props.kind === 'publishers'
);

const { submit, formError, isSubmitting, fieldProps, resetForm } = useAppForm({
    schema: NameFormSchema,
    initialValues: { name: '', aliases: [] },
    onSubmit: async (values) => {
        await update.mutateAsync({ id: props.id, ...values });
        return undefined;
    },
});

watch(
    found,
    (value) => {
        if (value) {
            resetForm({ values: { name: value.name, aliases: value.aliases } });
        }
    },
    { immediate: true }
);

const into = ref<{ id: string; name: string } | null>(null);
const confirmingMerge = ref(false);

function onMerge() {
    const target = into.value;
    if (!target) return;
    merge.mutate(
        { id: props.id, intoId: target.id },
        {
            onSuccess: () =>
                router.replace({
                    name:
                        props.kind === 'people'
                            ? 'admin-person'
                            : 'admin-publisher',
                    params: { id: target.id },
                }),
            onSettled: () => {
                confirmingMerge.value = false;
            },
        }
    );
}

const noun = computed(() => (props.kind === 'people' ? 'person' : 'publisher'));
</script>

<template>
    <div class="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div>
            <BackButton
                :to="{ name: 'admin', query: { tab: kind } }"
                text="Back to dashboard"
            />
        </div>

        <FormError :message="loadError?.message ?? null" />

        <div v-if="!found && !loadError" class="flex justify-center p-8">
            <Spinner class="size-6" />
        </div>

        <template v-if="found">
            <ConfirmDialog
                v-if="into"
                v-model:open="confirmingMerge"
                :title="`Merge ${found.name} into ${into.name}?`"
                :description="`Everything using ${found.name} will use ${into.name}, and ${found.name} becomes one of its other spellings.`"
                confirm-text="Merge"
                :pending="merge.isPending.value"
                @confirm="onMerge"
            />

            <form
                class="motion-safe:animate-in fade-in animation-duration-500 grid gap-4"
                novalidate
                @submit="submit"
            >
                <FormError :message="formError" />
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="name"
                >
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                            <Input v-no-autofill v-bind="componentField" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <FormField
                    v-slot="{ componentField }"
                    v-bind="fieldProps"
                    name="aliases"
                >
                    <FormItem>
                        <FormLabel>Other spellings</FormLabel>
                        <FormControl>
                            <TagsInput v-bind="componentField" class="w-full">
                                <TagsInputItem
                                    v-for="alias in componentField.modelValue"
                                    :key="alias"
                                    :value="alias"
                                >
                                    <TagsInputItemText />
                                    <TagsInputItemDelete />
                                </TagsInputItem>
                                <TagsInputInput
                                    placeholder="Add a spelling…"
                                    @keydown.enter.prevent
                                />
                            </TagsInput>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                </FormField>
                <div>
                    <Button type="submit" :disabled="isSubmitting">
                        <Spinner v-if="isSubmitting" />
                        Save
                    </Button>
                </div>
            </form>

            <template v-if="imprintInfo">
                <Separator />

                <section class="grid gap-2">
                    <h2 class="flex items-center gap-2 font-semibold">
                        Imprint of
                        <Spinner v-if="setParent.isPending.value" />
                    </h2>
                    <FormError
                        :message="setParent.error.value?.message ?? null"
                    />
                    <div class="flex gap-2">
                        <NamePicker
                            :model-value="imprintInfo.parent"
                            kind="publishers"
                            :exclude-id="id"
                            placeholder="Not an imprint"
                            @update:model-value="
                                setParent.mutate({
                                    id,
                                    parentId: $event?.id ?? null,
                                })
                            "
                        />
                        <Button
                            v-if="imprintInfo.parent"
                            variant="outline"
                            :disabled="setParent.isPending.value"
                            @click="setParent.mutate({ id, parentId: null })"
                        >
                            Clear
                        </Button>
                    </div>
                    <p
                        v-if="imprintInfo.imprints.length"
                        class="text-muted-foreground text-sm"
                    >
                        Imprints:
                        <template
                            v-for="(imprint, index) in imprintInfo.imprints"
                            :key="imprint.id"
                        >
                            <template v-if="index">, </template>
                            <RouterLink
                                :to="{
                                    name: 'admin-publisher',
                                    params: { id: imprint.id },
                                }"
                                class="underline"
                            >
                                {{ imprint.name }}
                            </RouterLink>
                        </template>
                    </p>
                </section>
            </template>

            <Separator />

            <section class="grid gap-2">
                <h2 class="font-semibold">Merge into another {{ noun }}</h2>
                <FormError :message="merge.error.value?.message ?? null" />
                <div class="flex gap-2">
                    <NamePicker
                        v-model="into"
                        :kind="kind"
                        :exclude-id="id"
                        :placeholder="`Search ${kind}…`"
                    />
                    <Button
                        variant="outline"
                        :disabled="!into"
                        @click="confirmingMerge = true"
                    >
                        <MergeIcon />
                        Merge
                    </Button>
                </div>
            </section>

            <Separator />

            <section class="grid gap-3">
                <h2 class="font-semibold">
                    Used by {{ found.uses.length }}
                    {{ kind === 'people' ? 'books' : 'ISBNs' }}
                </h2>
                <ItemGroup class="gap-2">
                    <Item
                        v-for="use in found.uses"
                        :key="`${use.id}:${use.detail}`"
                        variant="outline"
                        size="sm"
                        as-child
                    >
                        <RouterLink
                            :to="{ name: 'admin-item', params: { id: use.id } }"
                        >
                            <ItemContent class="min-w-0">
                                <ItemTitle class="line-clamp-2">
                                    {{ use.title }}
                                </ItemTitle>
                                <ItemDescription>
                                    {{ use.detail }}
                                </ItemDescription>
                            </ItemContent>
                        </RouterLink>
                    </Item>
                </ItemGroup>
            </section>
        </template>
    </div>
</template>
