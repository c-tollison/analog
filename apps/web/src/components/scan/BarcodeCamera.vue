<script setup lang="ts">
import { Alert, AlertDescription } from '@/components/shadcn-components/alert';
import { Button } from '@/components/shadcn-components/button';
import { Spinner } from '@/components/shadcn-components/spinner';
import { isbnFromBarcode } from '@/lib/isbn';

import {
    FlashlightIcon,
    FlashlightOffIcon,
    SwitchCameraIcon,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import {
    type BarcodeFormat,
    type DetectedBarcode,
    QrcodeStream,
} from 'vue-qrcode-reader';

defineProps<{ formats: BarcodeFormat[] }>();

const emit = defineEmits<{ detect: [isbn: string] }>();

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

const RESCAN_COOLDOWN_MS = 3000;
let lastScan: { isbn: string; at: number } | null = null;

function onDetect(codes: DetectedBarcode[]) {
    for (const code of codes) {
        const isbn = isbnFromBarcode(code.rawValue);
        if (!isbn) {
            continue;
        }

        const now = Date.now();
        if (lastScan?.isbn === isbn && now - lastScan.at < RESCAN_COOLDOWN_MS) {
            continue;
        }
        lastScan = { isbn, at: now };
        flashScanned();
        emit('detect', isbn);
        return;
    }
}

/** Ignores the last ISBN for a moment, while that book is swapped out. */
function cooldown() {
    if (lastScan) {
        lastScan.at = Date.now();
    }
}

defineExpose({ cooldown });

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
</script>

<template>
    <div>
        <div
            v-if="!cameraError"
            ref="cameraBox"
            class="bg-muted relative -mx-4 aspect-square overflow-hidden sm:mx-0 sm:aspect-4/3 sm:rounded-md"
        >
            <QrcodeStream
                :constraints="constraints"
                :formats="formats"
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
                v-if="cameraReady"
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
                    :aria-label="
                        torch ? 'Turn off flashlight' : 'Turn on flashlight'
                    "
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
                    Line up the barcode inside the box
                </span>
            </p>
            <div
                v-if="!cameraReady"
                class="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
                <Spinner class="size-6" />
                <span class="text-muted-foreground text-xs">
                    Starting camera…
                </span>
            </div>
        </div>
        <Alert v-else>
            <AlertDescription>{{ cameraError }}</AlertDescription>
        </Alert>
    </div>
</template>
