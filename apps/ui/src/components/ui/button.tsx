import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

import { cn } from '@/lib/utils';

const baseStyles =
    'inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800';

type ButtonAsButton = ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: undefined;
};

type ButtonAsLink = Omit<LinkProps, 'className'> & {
    className?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
    const className = cn(baseStyles, props.className);

    if (props.to !== undefined) {
        const { to, ...rest } = props;
        return <Link to={to} className={className} {...rest} />;
    }

    const { type = 'button', to: _to, ...rest } = props;
    return <button type={type} className={className} {...rest} />;
}
