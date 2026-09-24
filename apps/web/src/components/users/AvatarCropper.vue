<script setup lang="ts">
import { Slider } from '@/components/shadcn-components/slider';

import { ZoomInIcon, ZoomOutIcon } from '@lucide/vue';
import { useElementSize } from '@vueuse/core';
import { computed, ref, useTemplateRef, watch } from 'vue';

defineProps<{ src: string }>();

const emit = defineEmits<{ error: [] }>();

const OUTPUT_SIZE = 512;
const MAX_ZOOM = 4;
const WHEEL_ZOOM_SPEED = 0.002;

type Point = { x: number; y: number };

const frame = useTemplateRef<HTMLElement>('frame');
const image = useTemplateRef<HTMLImageElement>('image');
const { width: frameSize } = useElementSize(frame);

const natural = ref({ width: 0, height: 0 });
const zoom = ref([1]);
// The point of the image, in image pixels, shown at the frame's center.
const center = ref<Point>({ x: 0, y: 0 });

const zoomLevel = computed(() => zoom.value[0] ?? 1);
// The width of the square the frame shows, in image pixels.
const cropSize = computed(
    () => Math.min(natural.value.width, natural.value.height) / zoomLevel.value
);
// Screen pixels per image pixel.
const scale = computed(() =>
    cropSize.value ? frameSize.value / cropSize.value : 0
);

const imageStyle = computed(() => ({
    width: `${natural.value.width * scale.value}px`,
    height: `${natural.value.height * scale.value}px`,
    transform: `translate(${frameSize.value / 2 - center.value.x * scale.value}px, ${frameSize.value / 2 - center.value.y * scale.value}px)`,
}));

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

// Keeps the image covering the whole frame.
function clampCenter({ x, y }: Point): Point {
    const half = cropSize.value / 2;
    return {
        x: clamp(x, half, natural.value.width - half),
        y: clamp(y, half, natural.value.height - half),
    };
}

watch(zoomLevel, () => {
    center.value = clampCenter(center.value);
});

function onLoad() {
    const img = image.value;
    if (!img) {
        return;
    }
    natural.value = { width: img.naturalWidth, height: img.naturalHeight };
    center.value = { x: img.naturalWidth / 2, y: img.naturalHeight / 2 };
    zoom.value = [1];
}

let lastPointer: Point | undefined;

function onPointerDown(event: PointerEvent) {
    frame.value?.setPointerCapture(event.pointerId);
    lastPointer = { x: event.clientX, y: event.clientY };
}

function onPointerMove(event: PointerEvent) {
    if (!lastPointer || !scale.value) {
        return;
    }
    center.value = clampCenter({
        x: center.value.x - (event.clientX - lastPointer.x) / scale.value,
        y: center.value.y - (event.clientY - lastPointer.y) / scale.value,
    });
    lastPointer = { x: event.clientX, y: event.clientY };
}

function onPointerUp() {
    lastPointer = undefined;
}

function onWheel(event: WheelEvent) {
    zoom.value = [
        clamp(
            zoomLevel.value * (1 - event.deltaY * WHEEL_ZOOM_SPEED),
            1,
            MAX_ZOOM
        ),
    ];
}

/** The part of the image inside the frame, as a square JPEG. */
async function toFile(): Promise<File> {
    const img = image.value;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!img || !context) {
        throw new Error('Unable to read that photo.');
    }

    // JPEG has no transparency, so fill it white instead of black.
    context.fillStyle = 'white';
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    const half = cropSize.value / 2;
    context.drawImage(
        img,
        center.value.x - half,
        center.value.y - half,
        cropSize.value,
        cropSize.value,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
    );

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );
    if (!blob) {
        throw new Error('Unable to read that photo.');
    }
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

defineExpose({ toFile });
</script>

<template>
    <div class="grid gap-4">
        <div
            ref="frame"
            class="bg-muted relative mx-auto aspect-square w-full max-w-64 cursor-grab touch-none overflow-hidden rounded-md select-none active:cursor-grabbing"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @wheel.prevent="onWheel"
        >
            <img
                ref="image"
                :src="src"
                alt=""
                draggable="false"
                class="absolute top-0 left-0 max-w-none"
                :style="imageStyle"
                @load="onLoad"
                @error="emit('error')"
            />
            <div
                class="pointer-events-none absolute inset-0 rounded-full ring-999 ring-black/50"
            />
        </div>
        <div class="mx-auto flex w-full max-w-64 items-center gap-3">
            <ZoomOutIcon class="text-muted-foreground size-4 shrink-0" />
            <Slider
                v-model="zoom"
                :min="1"
                :max="MAX_ZOOM"
                :step="0.01"
                aria-label="Zoom"
            />
            <ZoomInIcon class="text-muted-foreground size-4 shrink-0" />
        </div>
    </div>
</template>
