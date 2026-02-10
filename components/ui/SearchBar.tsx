'use client';

import { useState, useEffect, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  onSearch: (query: string) => void;
  debounceDelay?: number;
}

/**
 * SearchBar component with debounced search functionality
 * Triggers search callback after user stops typing
 */
export default function SearchBar({
  onSearch,
  debounceDelay = 300,
  placeholder = 'Search...',
  className,
  ...props
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch(query);
    }, debounceDelay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, debounceDelay, onSearch]);

  return (
    <div className="relative w-full">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg',
          'text-foreground placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
          'transition-all duration-200',
          className
        )}
        aria-label="Search"
        {...props}
      />
    </div>
  );
}
