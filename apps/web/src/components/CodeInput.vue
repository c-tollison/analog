<script setup lang="ts">
import { OTP_LENGTH } from '@analog/types';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/shadcn-components/input-otp';

import { REGEXP_ONLY_DIGITS } from 'vue-input-otp';

const model = defineModel<string>({ default: '' });

defineEmits<{ complete: [value: string] }>();
</script>

<template>
    <InputOTP
        v-model="model"
        :maxlength="OTP_LENGTH"
        :pattern="REGEXP_ONLY_DIGITS"
        inputmode="numeric"
        autocomplete="one-time-code"
        autofocus
        @complete="$emit('complete', $event)"
    >
        <InputOTPGroup>
            <InputOTPSlot
                v-for="index in OTP_LENGTH"
                :key="index"
                :index="index - 1"
                class="size-10 text-base"
            />
        </InputOTPGroup>
    </InputOTP>
</template>
