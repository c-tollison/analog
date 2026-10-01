<script setup lang="ts">
import { Button } from '@/components/shadcn-components/button';
import { Calendar } from '@/components/shadcn-components/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/shadcn-components/popover';
import { formatDate } from '@/lib/dates';

import {
    type DateValue,
    getLocalTimeZone,
    parseAbsoluteToLocal,
    Time,
    toCalendarDate,
    toCalendarDateTime,
    today,
} from '@internationalized/date';
import { CalendarIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

// An ISO time, or null for no date.
const model = defineModel<string | null>({ required: true });

const isOpen = ref(false);
const timeZone = getLocalTimeZone();
const maxDate = today(timeZone);

const picked = computed(() =>
    model.value ? toCalendarDate(parseAbsoluteToLocal(model.value)) : undefined
);

// Saved at midday, so the day stays the same in nearby time zones.
function onPick(date: DateValue | undefined) {
    if (!date) return;
    if (!picked.value || date.compare(picked.value) !== 0) {
        model.value = toCalendarDateTime(date, new Time(12))
            .toDate(timeZone)
            .toISOString();
    }
    isOpen.value = false;
}
</script>

<template>
    <Popover v-model:open="isOpen">
        <PopoverTrigger as-child>
            <Button
                type="button"
                variant="outline"
                class="w-full justify-start font-normal"
                :class="{ 'text-muted-foreground': !model }"
            >
                <CalendarIcon />
                {{ model ? formatDate(model) : 'No date' }}
            </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
            <Calendar
                layout="month-and-year"
                prevent-deselect
                :model-value="picked"
                :default-placeholder="picked ?? maxDate"
                :max-value="maxDate"
                @update:model-value="onPick"
            />
        </PopoverContent>
    </Popover>
</template>
