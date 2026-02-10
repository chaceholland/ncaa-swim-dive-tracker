import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'swimmer'
    | 'diver'
    | 'freshman'
    | 'sophomore'
    | 'junior'
    | 'senior'
    | 'default';
}

/**
 * Badge component for displaying labels and categories
 * Supports various semantic variants with appropriate colors
 */
export default function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors';

  const variants = {
    swimmer: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    diver: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    freshman: 'bg-green-500/20 text-green-400 border border-green-500/30',
    sophomore: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    junior: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    senior: 'bg-red-500/20 text-red-400 border border-red-500/30',
    default: 'bg-slate-700/50 text-slate-300 border border-slate-600/50',
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </span>
  );
}
