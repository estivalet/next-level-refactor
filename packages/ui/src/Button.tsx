import type { ComponentProps } from 'react';

const VARIANTS = {
  primary: 'bg-[#990033] text-white hover:bg-[#b3003c]',
  secondary: 'bg-white/10 text-slate-200 hover:bg-white/15',
  danger: 'bg-red-700/80 text-white hover:bg-red-700',
} as const;

/** The app's button: one look for the launcher's gate screens and the admin console. */
export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type={type}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
