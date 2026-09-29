import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

export { default as Tooltip } from './Tooltip.vue';
export { default as TooltipContent } from './TooltipContent.vue';
export { default as TooltipProvider } from './TooltipProvider.vue';
export { default as TooltipTrigger } from './TooltipTrigger.vue';

export const tooltipVariants = cva('', {
    variants: {
        variant: {
            default: 'bg-foreground text-background',
            primary: 'bg-primary text-primary-foreground',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});

export const tooltipArrowVariants = cva(
    'size-2.5 rotate-45 rounded-xs z-50 translate-y-[calc(-50%_-_2px)]',
    {
        variants: {
            variant: {
                default: 'bg-foreground fill-foreground',
                primary: 'bg-primary fill-primary',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);
export type TooltipVariants = VariantProps<typeof tooltipVariants>;
