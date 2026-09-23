<script setup lang="ts">
import { MAX_PAGE_SIZE, MediaFormat } from '@analog/types';
import FormError from '@/components/FormError.vue';
import BookResult from '@/components/scan/BookResult.vue';
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
import { Button } from '@/components/shadcn-components/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/shadcn-components/form';
import { Input } from '@/components/shadcn-components/input';
import { Label } from '@/components/shadcn-components/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/shadcn-components/select';
import { Separator } from '@/components/shadcn-components/separator';
import { Spinner } from '@/components/shadcn-components/spinner';
import { useAppForm } from '@/composables/useAppForm';
import { type IsbnLookup, useIsbnLookup } from '@/composables/useCatalog';
import { useCollections } from '@/composables/useCollections';
import { IsbnLookupFormSchema } from '@/lib/catalog-schemas';
import { isbnFromBarcode } from '@/lib/isbn';
import { MEDIA_TYPES, type MediaTypeValue } from '@/lib/media-types';
import { vNoAutofill } from '@/lib/no-autofill';

import {
    ArrowLeftIcon,
    FlashlightIcon,
    FlashlightOffIcon,
    SwitchCameraIcon,
} from '@lucide/vue';
import { useLocalStorage } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { type DetectedBarcode, QrcodeStream } from 'vue-qrcode-reader';
import { useRoute } from 'vue-router';

const route = useRoute();
const lookupIsbn = useIsbnLookup();

const mediaType = ref<MediaTypeValue>(MediaFormat.Book);
const lastCollectionId = useLocalStorage('analog:last-collection', '');
const collectionId = ref('');

const collectionsList = useCollections(MAX_PAGE_SIZE);
const collections = computed(() => collectionsList.items);

const lookup = ref<IsbnLookup | null>(null);
const cameraError = ref<string | null>(null);
const cameraReady = ref(false);
const facingMode = ref<'environment' | 'user'>('environment');
const canFlip = ref(false);
const canTorch = ref(false);
const torch = ref(false);
const justScanned = ref(false);
const cameraBox = ref<HTMLElement>();

// 1D barcodes are thin; the browser's default resolution is often too low to
// read them reliably.
const constraints = computed<MediaTrackConstraints>(() => ({
    facingMode: facingMode.value,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
}));

// Camera scans fill in the same field and submit, so both paths share one
// validation and error display.
const {
    submit,
    formError,
    isSubmitting,
    fieldProps,
    setFieldValue,
    resetForm,
} = useAppForm({
    schema: IsbnLookupFormSchema,
    initialValues: { isbn: '' },
    onSubmit: async ({ isbn }) => {
        lookup.value = await lookupIsbn(isbn);
        return undefined;
    },
});

const formats = computed(
    () => MEDIA_TYPES.find((t) => t.value === mediaType.value)?.formats ?? []
);
const collection = computed(() =>
    collections.value.find((c) => c.id === collectionId.value)
);

const paused = computed(() => isSubmitting.value);

function selectCollection(id: string) {
    collectionId.value = id;
    lastCollectionId.value = id;
}

watch(
    collections,
    (list) => {
        if (collectionId.value || !list.length) {
            return;
        }
        const preferred = [route.query.collection, lastCollectionId.value].find(
            (id) => list.some((c) => c.id === id)
        );
        const initial = preferred ?? list[0]?.id;
        if (typeof initial === 'string') {
            selectCollection(initial);
        }
    },
    { immediate: true }
);

const RESCAN_COOLDOWN_MS = 3000;
let lastScan: { isbn: string; at: number } | null = null;

function onDetect(codes: DetectedBarcode[]) {
    if (isSubmitting.value) {
        return;
    }
    for (const code of codes) {
        const isbn = isbnFromBarcode(code.rawValue);
        if (!isbn || isbn === lookup.value?.book.isbn) {
            continue;
        }

        const now = Date.now();
        if (lastScan?.isbn === isbn && now - lastScan.at < RESCAN_COOLDOWN_MS) {
            continue;
        }
        lastScan = { isbn, at: now };
        flashScanned();
        setFieldValue('isbn', isbn);
        void submit();
        return;
    }
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;

function flashScanned() {
    justScanned.value = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (justScanned.value = false), 1000);
}

// Runs every frame outside Vue, so it must not touch reactive state.
function outlineBarcodes(
    codes: DetectedBarcode[],
    ctx: CanvasRenderingContext2D
) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    for (const { rawValue, boundingBox } of codes) {
        if (isbnFromBarcode(rawValue)) {
            const { x, y, width, height } = boundingBox;
            ctx.strokeRect(x - 6, y - 6, width + 12, height + 12);
        }
    }
}

async function onCameraOn(capabilities: Partial<MediaTrackCapabilities>) {
    cameraReady.value = true;
    canTorch.value = 'torch' in capabilities && Boolean(capabilities.torch);

    if (torch.value) {
        void setTorch(canTorch.value);
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    canFlip.value = devices.filter((d) => d.kind === 'videoinput').length > 1;
}

async function setTorch(on: boolean) {
    torch.value = on;
    const stream = cameraBox.value?.querySelector('video')?.srcObject;
    const track =
        stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined;
    try {
        await track?.applyConstraints({ advanced: [{ torch: on }] });
    } catch {
        torch.value = false;
    }
}

function flipCamera() {
    cameraReady.value = false;
    torch.value = false;
    facingMode.value =
        facingMode.value === 'environment' ? 'user' : 'environment';
}

function onCameraError(err: Error) {
    const messages: Record<string, string> = {
        NotAllowedError: 'Camera permission was denied.',
        NotFoundError: 'No camera found on this device.',
        NotReadableError: 'The camera is already in use.',
        InsecureContextError:
            'The camera needs HTTPS or localhost. Enter the ISBN below instead.',
        StreamApiNotSupportedError: "This browser can't access the camera.",
    };
    cameraError.value = messages[err.name] ?? `Camera error: ${err.message}`;
}

function scanAnother() {
    lookup.value = null;
    lastScan = null;
    resetForm();
}
</script>

<template>
    <main class="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
        <div>
            <Button variant="ghost" size="sm" class="-ml-2" as-child>
                <RouterLink :to="{ name: 'collections' }">
                    <ArrowLeftIcon />
                    Collections
                </RouterLink>
            </Button>
        </div>

        <div class="grid gap-1">
            <h1 class="text-lg font-semibold">Scan</h1>
            <p class="text-muted-foreground text-sm">
                Point the camera at the barcode, or enter the ISBN.
            </p>
        </div>

        <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-1.5">
                <Label for="media-type">Type</Label>
                <Select v-model="mediaType">
                    <SelectTrigger id="media-type" class="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="type in MEDIA_TYPES"
                            :key="type.value"
                            :value="type.value"
                        >
                            {{ type.label }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div class="grid gap-1.5">
                <Label for="collection">Add to</Label>
                <Select
                    :model-value="collectionId"
                    :disabled="!collections.length"
                    @update:model-value="
                                (id) => selectCollection(String(id))
                            "
                >
                    <SelectTrigger id="collection" class="w-full">
                        <Spinner v-if="collectionsList.isLoading" />
                        <SelectValue
                            :placeholder="
                                        collectionsList.isLoading
                                            ? 'Loading…'
                                            : 'No collections'
                                    "
                        />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="c in collections"
                            :key="c.id"
                            :value="c.id"
                        >
                            {{ c.name }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <FormError :message="collectionsList.error" />
        <Alert
            v-if="
                        !collectionsList.isLoading &&
                        !collectionsList.error &&
                        !collections.length
                    "
        >
            <AlertDescription>
                <span>
                    You need a collection to add items to.
                    <RouterLink class="underline" :to="{ name: 'collections' }">
                        Create one
                    </RouterLink>
                    first.
                </span>
            </AlertDescription>
        </Alert>

        <div
            v-if="!cameraError"
            ref="cameraBox"
            class="bg-muted relative -mx-4 aspect-square overflow-hidden sm:mx-0 sm:aspect-4/3 sm:rounded-md"
        >
            <QrcodeStream
                :constraints="constraints"
                :formats="formats"
                :paused="paused"
                :track="outlineBarcodes"
                @detect="onDetect"
                @error="onCameraError"
                @camera-on="onCameraOn"
            />
            <div
                class="pointer-events-none absolute inset-0 ring-4 ring-transparent transition-shadow duration-300 ring-inset sm:rounded-md"
                :class="{ 'ring-green-500': justScanned }"
            />
            <div
                v-if="cameraReady && !paused"
                class="pointer-events-none absolute inset-x-8 inset-y-3/10 rounded-sm border-2 border-white/60"
            >
                <div
                    class="animate-scan-sweep absolute inset-x-0 h-0.5 bg-red-500/80 shadow-[0_0_8px_2px] shadow-red-500/60 motion-reduce:top-1/2 motion-reduce:animate-none"
                />
            </div>
            <div
                v-if="cameraReady && (canFlip || canTorch)"
                class="absolute top-2 right-2 flex gap-1"
            >
                <Button
                    v-if="canTorch"
                    variant="secondary"
                    size="icon-lg"
                    :aria-label="torch ? 'Turn off flashlight' : 'Turn on flashlight'"
                    @click="setTorch(!torch)"
                >
                    <FlashlightOffIcon v-if="torch" />
                    <FlashlightIcon v-else />
                </Button>
                <Button
                    v-if="canFlip"
                    variant="secondary"
                    size="icon-lg"
                    aria-label="Switch camera"
                    @click="flipCamera"
                >
                    <SwitchCameraIcon />
                </Button>
            </div>
            <p
                v-if="cameraReady"
                class="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center"
            >
                <span
                    class="rounded-full bg-black/60 px-3 py-1 text-xs text-white"
                >
                    {{
                                isSubmitting
                                    ? 'Looking up book…'
                                    : 'Line up the barcode inside the box'
                    }}
                </span>
            </p>
            <div
                v-if="!cameraReady || isSubmitting"
                class="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
                <Spinner class="size-6" />
                <span v-if="!cameraReady" class="text-muted-foreground text-xs">
                    Starting camera…
                </span>
            </div>
        </div>
        <Alert v-else>
            <AlertDescription>{{ cameraError }}</AlertDescription>
        </Alert>

        <form class="grid gap-2" novalidate @submit="submit">
            <FormError :message="formError" />
            <FormField
                v-slot="{ componentField }"
                v-bind="fieldProps"
                name="isbn"
            >
                <FormItem>
                    <FormLabel>ISBN</FormLabel>
                    <div class="flex gap-2">
                        <FormControl>
                            <Input
                                inputmode="numeric"
                                v-no-autofill
                                placeholder="978…"
                                v-bind="componentField"
                            />
                        </FormControl>
                        <Button
                            type="submit"
                            variant="outline"
                            :disabled="isSubmitting"
                        >
                            <Spinner v-if="isSubmitting" />
                            Look up
                        </Button>
                    </div>
                    <FormMessage />
                </FormItem>
            </FormField>
        </form>

        <template v-if="lookup && collection">
            <Separator />
            <BookResult
                :key="`${lookup.book.isbn}:${collection.id}`"
                :lookup="lookup"
                :collection-id="collection.id"
                :collection-name="collection.name"
                @done="scanAnother"
            />
        </template>
    </main>
</template>
