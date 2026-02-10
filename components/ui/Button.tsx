import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Button component with multiple variants and sizes
 * Supports all standard HTML button attributes
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900';

    const variants = {
      primary:
        'bg-primary text-white hover:bg-primary/90 active:bg-primary/80 focus-visible:ring-primary/50',
      secondary:
        'bg-secondary text-white hover:bg-secondary/90 active:bg-secondary/80 focus-visible:ring-secondary/50',
      outline:
        'border-2 border-slate-600 text-foreground hover:bg-slate-800 active:bg-slate-700 focus-visible:ring-slate-500',
      ghost:
        'text-foreground hover:bg-slate-800 active:bg-slate-700 focus-visible:ring-slate-500',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
