import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface LoadingSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'text' | 'circle' | 'avatar';
}

/**
 * LoadingSkeleton base component with shimmer animation
 * Used for loading states throughout the application
 */
export function LoadingSkeleton({
  variant = 'card',
  className,
  ...props
}: LoadingSkeletonProps) {
  const baseStyles = 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800';
  const shimmerStyles = 'animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%]';

  const variants = {
    card: 'w-full h-64 rounded-lg',
    text: 'w-full h-4 rounded',
    circle: 'w-12 h-12 rounded-full',
    avatar: 'w-16 h-16 rounded-full',
  };

  return (
    <div
      className={cn(baseStyles, shimmerStyles, variants[variant], className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * TeamCardSkeleton - Loading state for team cards
 * Matches the structure of the TeamCard component
 */
export function TeamCardSkeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
      {/* Team logo */}
      <div className="flex items-center justify-center">
        <LoadingSkeleton variant="avatar" className="w-20 h-20" />
      </div>

      {/* Team name */}
      <LoadingSkeleton variant="text" className="h-6 w-3/4 mx-auto" />

      {/* Conference */}
      <LoadingSkeleton variant="text" className="h-4 w-1/2 mx-auto" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 pt-4">
        <div className="space-y-2">
          <LoadingSkeleton variant="text" className="h-3 w-full" />
          <LoadingSkeleton variant="text" className="h-5 w-full" />
        </div>
        <div className="space-y-2">
          <LoadingSkeleton variant="text" className="h-3 w-full" />
          <LoadingSkeleton variant="text" className="h-5 w-full" />
        </div>
      </div>

      {/* View button */}
      <LoadingSkeleton variant="text" className="h-10 w-full rounded-lg" />
    </div>
  );
}

/**
 * AthleteCardSkeleton - Loading state for athlete cards
 * Matches the structure of the AthleteCard component
 */
export function AthleteCardSkeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
      {/* Athlete avatar and header */}
      <div className="flex items-start gap-4">
        <LoadingSkeleton variant="avatar" className="w-16 h-16" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton variant="text" className="h-5 w-3/4" />
          <LoadingSkeleton variant="text" className="h-4 w-1/2" />
        </div>
      </div>

      {/* Badges */}
      <div className="flex gap-2">
        <LoadingSkeleton variant="text" className="h-6 w-16 rounded-full" />
        <LoadingSkeleton variant="text" className="h-6 w-20 rounded-full" />
      </div>

      {/* Stats */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between">
          <LoadingSkeleton variant="text" className="h-4 w-1/3" />
          <LoadingSkeleton variant="text" className="h-4 w-1/4" />
        </div>
        <div className="flex justify-between">
          <LoadingSkeleton variant="text" className="h-4 w-1/3" />
          <LoadingSkeleton variant="text" className="h-4 w-1/4" />
        </div>
      </div>

      {/* View button */}
      <LoadingSkeleton variant="text" className="h-10 w-full rounded-lg" />
    </div>
  );
}
