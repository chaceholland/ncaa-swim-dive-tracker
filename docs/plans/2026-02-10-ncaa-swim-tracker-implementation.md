# NCAA Swim & Dive Tracker - Visual Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the NCAA D1 Swimming & Diving Tracker into a visually stunning, media-rich experience with team color gradients, proper logos, and full-bleed modern layout.

**Architecture:** Build a modern Next.js 14+ application with App Router, TypeScript, Tailwind CSS for styling, Framer Motion for animations, and Supabase for data. The architecture follows a component-driven approach with reusable UI components, custom hooks for data fetching, and optimized image handling.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Supabase (PostgreSQL), Vercel (deployment)

---

## Task 1: Project Setup & Dependencies

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `.env.local`
- Create: `.gitignore`

**Step 1: Initialize Next.js project**

Run: `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"`

Options:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- App Router: Yes
- Import alias: Yes (@/*)

Expected: Project initialized with Next.js 14+

**Step 2: Install additional dependencies**

Run:
```bash
npm install @supabase/supabase-js framer-motion react-intersection-observer clsx tailwind-merge
npm install -D @types/node
```

Expected: Dependencies installed successfully

**Step 3: Create environment variables file**

Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Note: Replace with actual Supabase credentials

**Step 4: Configure Tailwind with custom theme**

Update `tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0A1628",
          cyan: "#00D4FF",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(50px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 5: Configure Next.js for images**

Update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.edu',
      },
      {
        protocol: 'https',
        hostname: 'your-supabase-project.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
```

**Step 6: Commit initial setup**

Run:
```bash
git init
git add .
git commit -m "chore: initial Next.js project setup with dependencies"
```

Expected: Initial commit created

---

## Task 2: Supabase Schema & Data Setup

**Files:**
- Create: `supabase/migrations/001_create_teams_table.sql`
- Create: `supabase/migrations/002_create_athletes_table.sql`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/types.ts`

**Step 1: Create Supabase client**

Create `lib/supabase/client.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 2: Define TypeScript types**

Create `lib/supabase/types.ts`:
```typescript
export interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  logo_fallback_url: string | null;
  primary_color: string;
  secondary_color: string;
  conference: string;
  conference_display_name: string;
  athlete_count: number;
  created_at: string;
  updated_at: string;
}

export interface Athlete {
  id: string;
  name: string;
  team_id: string;
  photo_url: string | null;
  athlete_type: 'swimmer' | 'diver';
  class_year: 'freshman' | 'sophomore' | 'junior' | 'senior';
  hometown: string | null;
  profile_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Conference = 'SEC' | 'ACC' | 'Big Ten' | 'Big 12' | 'Ivy League' | 'Patriot League' | 'Other';
```

**Step 3: Create teams table migration**

Create `supabase/migrations/001_create_teams_table.sql`:
```sql
-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  logo_fallback_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#1E40AF',
  secondary_color TEXT NOT NULL DEFAULT '#3B82F6',
  conference TEXT NOT NULL,
  conference_display_name TEXT NOT NULL,
  athlete_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on conference for faster filtering
CREATE INDEX idx_teams_conference ON teams(conference);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Step 4: Create athletes table migration**

Create `supabase/migrations/002_create_athletes_table.sql`:
```sql
-- Create athletes table
CREATE TABLE IF NOT EXISTS athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  photo_url TEXT,
  athlete_type TEXT CHECK (athlete_type IN ('swimmer', 'diver')),
  class_year TEXT CHECK (class_year IN ('freshman', 'sophomore', 'junior', 'senior')),
  hometown TEXT,
  profile_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_athletes_team_id ON athletes(team_id);
CREATE INDEX idx_athletes_type ON athletes(athlete_type);
CREATE INDEX idx_athletes_class_year ON athletes(class_year);

-- Create updated_at trigger
CREATE TRIGGER athletes_updated_at
BEFORE UPDATE ON athletes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to update team athlete_count
CREATE OR REPLACE FUNCTION update_team_athlete_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE teams SET athlete_count = athlete_count + 1 WHERE id = NEW.team_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE teams SET athlete_count = athlete_count - 1 WHERE id = OLD.team_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.team_id != NEW.team_id THEN
    UPDATE teams SET athlete_count = athlete_count - 1 WHERE id = OLD.team_id;
    UPDATE teams SET athlete_count = athlete_count + 1 WHERE id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER athletes_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON athletes
FOR EACH ROW
EXECUTE FUNCTION update_team_athlete_count();
```

**Step 5: Apply migrations to Supabase**

Note: Apply these migrations through Supabase dashboard SQL editor or CLI

Run: `supabase db push` (if using Supabase CLI)

Expected: Tables created successfully

**Step 6: Commit database schema**

Run:
```bash
git add lib/supabase supabase/migrations
git commit -m "feat: add Supabase schema and client setup"
```

---

## Task 3: Utility Functions & Helpers

**Files:**
- Create: `lib/utils.ts`
- Create: `lib/hooks/useIntersectionObserver.ts`
- Create: `lib/hooks/useLocalStorage.ts`

**Step 1: Create utility functions**

Create `lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate team gradient CSS
export function getTeamGradient(primaryColor: string, secondaryColor: string) {
  return `linear-gradient(45deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
}

// Get initials from team name
export function getTeamInitials(name: string): string {
  const words = name.split(' ').filter(word => word.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Determine text color based on background
export function getContrastColor(hexColor: string): 'white' | 'black' {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? 'black' : 'white';
}

// Format last updated timestamp
export function formatLastUpdated(date: string): string {
  const now = new Date();
  const updated = new Date(date);
  const diffMs = now.getTime() - updated.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return updated.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Stagger animation delay for cards
export function getStaggerDelay(index: number, baseDelay: number = 0.05): number {
  return index * baseDelay;
}
```

**Step 2: Create intersection observer hook**

Create `lib/hooks/useIntersectionObserver.ts`:
```typescript
import { useEffect, useState, useRef } from 'react';

interface UseIntersectionObserverProps {
  threshold?: number;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

export function useIntersectionObserver({
  threshold = 0.1,
  rootMargin = '0px',
  freezeOnceVisible = true,
}: UseIntersectionObserverProps = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsIntersecting(isVisible);

        if (isVisible && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, hasBeenVisible]);

  // Return frozen state if option is enabled and element has been visible
  return {
    ref,
    isIntersecting: freezeOnceVisible && hasBeenVisible ? true : isIntersecting,
    hasBeenVisible,
  };
}
```

**Step 3: Create local storage hook**

Create `lib/hooks/useLocalStorage.ts`:
```typescript
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
    }
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  return [storedValue, setValue] as const;
}
```

**Step 4: Commit utilities**

Run:
```bash
git add lib/utils.ts lib/hooks
git commit -m "feat: add utility functions and custom hooks"
```

---

## Task 4: Base UI Components

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/SearchBar.tsx`
- Create: `components/ui/LoadingSkeleton.tsx`

**Step 1: Create Button component**

Create `components/ui/Button.tsx`:
```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-brand-cyan text-white hover:bg-brand-cyan/90 shadow-lg shadow-brand-cyan/20': variant === 'primary',
            'bg-white text-brand-navy border border-gray-200 hover:bg-gray-50': variant === 'secondary',
            'border border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10': variant === 'outline',
            'hover:bg-gray-100 text-gray-700': variant === 'ghost',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**Step 2: Create Badge component**

Create `components/ui/Badge.tsx`:
```typescript
import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'swimmer' | 'diver' | 'freshman' | 'sophomore' | 'junior' | 'senior' | 'default';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors',
        {
          'bg-blue-100 text-blue-700': variant === 'swimmer',
          'bg-teal-100 text-teal-700': variant === 'diver',
          'bg-green-100 text-green-700': variant === 'freshman',
          'bg-blue-100 text-blue-700': variant === 'sophomore',
          'bg-orange-100 text-orange-700': variant === 'junior',
          'bg-red-100 text-red-700': variant === 'senior',
          'bg-gray-100 text-gray-700': variant === 'default',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
```

**Step 3: Create SearchBar component**

Create `components/ui/SearchBar.tsx`:
```typescript
'use client';

import { InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch?: (value: string) => void;
  debounceMs?: number;
}

export function SearchBar({
  className,
  onSearch,
  debounceMs = 300,
  placeholder = 'Search teams, athletes, conferences...',
  ...props
}: SearchBarProps) {
  const [value, setValue] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Debounce search
    if (onSearch) {
      const timeoutId = setTimeout(() => {
        onSearch(newValue);
      }, debounceMs);

      return () => clearTimeout(timeoutId);
    }
  };

  return (
    <div className="relative flex-1 max-w-2xl">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'w-full pl-12 pr-4 py-3 rounded-2xl',
          'bg-white border border-gray-200',
          'text-gray-900 placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent',
          'transition-all duration-300',
          className
        )}
        {...props}
      />
    </div>
  );
}
```

**Step 4: Create LoadingSkeleton component**

Create `components/ui/LoadingSkeleton.tsx`:
```typescript
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'card' | 'text' | 'circle' | 'avatar';
}

export function LoadingSkeleton({ className, variant = 'card' }: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200',
        'bg-[length:200%_100%] animate-shimmer',
        {
          'h-48 rounded-2xl': variant === 'card',
          'h-4 rounded': variant === 'text',
          'w-12 h-12 rounded-full': variant === 'circle',
          'w-40 h-40 rounded-full': variant === 'avatar',
        },
        className
      )}
    />
  );
}

export function TeamCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <LoadingSkeleton variant="circle" className="w-20 h-20" />
        <LoadingSkeleton variant="circle" className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <LoadingSkeleton variant="text" className="w-3/4" />
        <LoadingSkeleton variant="text" className="w-1/2" />
      </div>
      <LoadingSkeleton variant="text" className="w-1/3" />
    </div>
  );
}

export function AthleteCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <LoadingSkeleton className="h-64 rounded-none" />
      <div className="p-4 space-y-3">
        <LoadingSkeleton variant="text" className="w-3/4 mx-auto" />
        <div className="flex gap-2 justify-center">
          <LoadingSkeleton variant="text" className="w-16 h-6" />
          <LoadingSkeleton variant="text" className="w-16 h-6" />
        </div>
        <LoadingSkeleton variant="text" className="w-2/3 mx-auto" />
        <LoadingSkeleton className="h-10 rounded-xl" />
      </div>
    </div>
  );
}
```

**Step 5: Commit UI components**

Run:
```bash
git add components/ui
git commit -m "feat: add base UI components (Button, Badge, SearchBar, Loading)"
```

---

## Task 5: Navigation Component

**Files:**
- Create: `components/Navigation.tsx`
- Create: `components/FilterPills.tsx`

**Step 1: Create Navigation component**

Create `components/Navigation.tsx`:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { SearchBar } from './ui/SearchBar';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

interface NavigationProps {
  onSearch?: (value: string) => void;
  favoriteCount?: number;
  missingDataCount?: number;
}

export function Navigation({
  onSearch,
  favoriteCount = 0,
  missingDataCount = 0
}: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        'backdrop-blur-xl bg-white/80',
        isScrolled ? 'shadow-lg' : 'shadow-none'
      )}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-4">
          {/* Logo/Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-cyan to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-brand-navy hidden sm:block">
              NCAA D1 Swimming & Diving
            </h1>
          </div>

          {/* Search Bar */}
          <SearchBar onSearch={onSearch} className="hidden md:block" />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="relative">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Favorites
              {favoriteCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-brand-cyan text-white text-xs rounded-full">
                  {favoriteCount}
                </span>
              )}
            </Button>

            {missingDataCount > 0 && (
              <Button variant="outline" size="sm" className="hidden lg:flex">
                Missing Data
                <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  {missingDataCount}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-4">
          <SearchBar onSearch={onSearch} />
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Create FilterPills component**

Create `components/FilterPills.tsx`:
```typescript
'use client';

import { cn } from '@/lib/utils';

type ViewMode = 'rosters' | 'teams';
type Conference = 'all' | 'sec' | 'big-ten' | 'acc' | 'big-12' | 'ivy' | 'other';
type AthleteType = 'all' | 'swimmers' | 'divers';

interface FilterPillsProps {
  viewMode: ViewMode;
  selectedConference: Conference;
  selectedAthleteType: AthleteType;
  onViewModeChange: (mode: ViewMode) => void;
  onConferenceChange: (conference: Conference) => void;
  onAthleteTypeChange: (type: AthleteType) => void;
  counts: {
    rosters: number;
    teams: number;
    conferences: Record<Conference, number>;
    athleteTypes: Record<AthleteType, number>;
  };
}

export function FilterPills({
  viewMode,
  selectedConference,
  selectedAthleteType,
  onViewModeChange,
  onConferenceChange,
  onAthleteTypeChange,
  counts,
}: FilterPillsProps) {
  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <Pill
            active={viewMode === 'rosters'}
            onClick={() => onViewModeChange('rosters')}
            count={counts.rosters}
          >
            Rosters
          </Pill>
          <Pill
            active={viewMode === 'teams'}
            onClick={() => onViewModeChange('teams')}
            count={counts.teams}
          >
            Teams
          </Pill>
        </div>

        {/* Conference Filters */}
        <div className="overflow-x-auto">
          <div className="flex gap-2 mb-4 min-w-max">
            <Pill
              active={selectedConference === 'all'}
              onClick={() => onConferenceChange('all')}
              count={counts.conferences.all}
            >
              All
            </Pill>
            <Pill
              active={selectedConference === 'sec'}
              onClick={() => onConferenceChange('sec')}
              count={counts.conferences.sec}
            >
              SEC
            </Pill>
            <Pill
              active={selectedConference === 'big-ten'}
              onClick={() => onConferenceChange('big-ten')}
              count={counts.conferences['big-ten']}
            >
              Big Ten
            </Pill>
            <Pill
              active={selectedConference === 'acc'}
              onClick={() => onConferenceChange('acc')}
              count={counts.conferences.acc}
            >
              ACC
            </Pill>
            <Pill
              active={selectedConference === 'big-12'}
              onClick={() => onConferenceChange('big-12')}
              count={counts.conferences['big-12']}
            >
              Big 12
            </Pill>
            <Pill
              active={selectedConference === 'ivy'}
              onClick={() => onConferenceChange('ivy')}
              count={counts.conferences.ivy}
            >
              Ivy
            </Pill>
            <Pill
              active={selectedConference === 'other'}
              onClick={() => onConferenceChange('other')}
              count={counts.conferences.other}
            >
              Other
            </Pill>
          </div>
        </div>

        {/* Athlete Type Filters */}
        <div className="flex gap-2">
          <Pill
            active={selectedAthleteType === 'all'}
            onClick={() => onAthleteTypeChange('all')}
            count={counts.athleteTypes.all}
          >
            All Athletes
          </Pill>
          <Pill
            active={selectedAthleteType === 'swimmers'}
            onClick={() => onAthleteTypeChange('swimmers')}
            count={counts.athleteTypes.swimmers}
          >
            Swimmers
          </Pill>
          <Pill
            active={selectedAthleteType === 'divers'}
            onClick={() => onAthleteTypeChange('divers')}
            count={counts.athleteTypes.divers}
          >
            Divers
          </Pill>
        </div>
      </div>
    </div>
  );
}

interface PillProps {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}

function Pill({ active, onClick, count, children }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300',
        'flex items-center gap-2 whitespace-nowrap',
        active
          ? 'bg-gradient-to-r from-brand-cyan to-blue-600 text-white shadow-lg shadow-brand-cyan/30'
          : 'bg-white text-gray-700 border border-gray-300 hover:border-brand-cyan hover:bg-brand-cyan/5'
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-bold',
            active ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
```

**Step 3: Commit navigation components**

Run:
```bash
git add components/Navigation.tsx components/FilterPills.tsx
git commit -m "feat: add navigation and filter pills components"
```

---

## Task 6: Hero Section Component

**Files:**
- Create: `components/HeroSection.tsx`
- Create: `public/wave-pattern.svg`

**Step 1: Create wave pattern SVG**

Create `public/wave-pattern.svg`:
```svg
<svg width="1920" height="600" viewBox="0 0 1920 600" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 300C320 200 640 400 960 300C1280 200 1600 400 1920 300V600H0V300Z" fill="url(#wave-gradient)" opacity="0.1"/>
  <defs>
    <linearGradient id="wave-gradient" x1="0" y1="0" x2="1920" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D4FF"/>
      <stop offset="50%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#00D4FF"/>
    </linearGradient>
  </defs>
</svg>
```

**Step 2: Create HeroSection component**

Create `components/HeroSection.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  totalTeams: number;
  totalAthletes: number;
  missingData: number;
  lastUpdated: string;
}

export function HeroSection({
  totalTeams,
  totalAthletes,
  missingData,
  lastUpdated
}: HeroSectionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-blue-900 to-brand-navy">
        {/* Wave Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'url(/wave-pattern.svg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Animated Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan/20 via-blue-500/20 to-brand-cyan/20 animate-gradient" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            NCAA D1 Men's
            <br />
            <span className="bg-gradient-to-r from-brand-cyan to-blue-400 bg-clip-text text-transparent">
              Swimming & Diving
            </span>
          </h1>

          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Track rosters, teams, and athletes across all Division I conferences
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto"
        >
          <StatCard
            icon={
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            }
            label="Teams"
            value={totalTeams}
            mounted={mounted}
          />
          <StatCard
            icon={
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            }
            label="Athletes"
            value={totalAthletes}
            mounted={mounted}
          />
          <StatCard
            icon={
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            }
            label="Missing Data"
            value={missingData}
            mounted={mounted}
            highlight
          />
        </motion.div>

        {/* Last Updated */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-8 text-gray-400 text-sm"
        >
          Last updated: {lastUpdated}
        </motion.p>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.6,
            repeat: Infinity,
            repeatType: 'reverse',
            repeatDelay: 0.5,
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </div>
    </section>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  mounted: boolean;
  highlight?: boolean;
}

function StatCard({ icon, label, value, mounted, highlight }: StatCardProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!mounted) return;

    let start = 0;
    const end = value;
    const duration = 2000;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [mounted, value]);

  return (
    <div className={`
      relative p-6 rounded-2xl backdrop-blur-xl
      ${highlight
        ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-400/30'
        : 'bg-white/10 border border-white/20'
      }
    `}>
      <div className={`
        mb-3 inline-block p-3 rounded-xl
        ${highlight ? 'bg-orange-500/20 text-orange-300' : 'bg-brand-cyan/20 text-brand-cyan'}
      `}>
        {icon}
      </div>
      <div className="text-4xl font-bold text-white mb-1">
        {mounted ? count.toLocaleString() : '0'}
      </div>
      <div className="text-sm text-gray-300 font-medium">{label}</div>
    </div>
  );
}
```

**Step 3: Commit hero section**

Run:
```bash
git add components/HeroSection.tsx public/wave-pattern.svg
git commit -m "feat: add hero section with animated stats"
```

---

## Task 7: Team Card Component

**Files:**
- Create: `components/TeamCard.tsx`

**Step 1: Create TeamCard component**

Create `components/TeamCard.tsx`:
```typescript
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import { Team } from '@/lib/supabase/types';
import { getTeamGradient, getTeamInitials, getContrastColor, cn } from '@/lib/utils';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';

interface TeamCardProps {
  team: Team;
  index: number;
  onFavoriteToggle?: (teamId: string) => void;
  isFavorite?: boolean;
}

export function TeamCard({ team, index, onFavoriteToggle, isFavorite = false }: TeamCardProps) {
  const [imageError, setImageError] = useState(false);
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });

  const gradient = getTeamGradient(team.primary_color, team.secondary_color);
  const textColor = getContrastColor(team.primary_color);
  const initials = getTeamInitials(team.name);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{
        duration: 0.6,
        delay: index * 0.05,
        ease: 'easeOut'
      }}
      className="group relative"
    >
      <div
        className={cn(
          'relative h-52 rounded-2xl overflow-hidden',
          'shadow-lg hover:shadow-2xl',
          'transition-all duration-300',
          'hover:-translate-y-2 hover:scale-[1.02]',
          'cursor-pointer'
        )}
        style={{ background: gradient }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-300" />

        {/* Subtle Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255,255,255,0.1) 10px,
              rgba(255,255,255,0.1) 20px
            )`
          }}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-6">
          {/* Top Row: Logo & Favorite */}
          <div className="flex items-start justify-between">
            {/* Team Logo */}
            <div className="w-20 h-20 rounded-xl bg-white/95 shadow-lg flex items-center justify-center overflow-hidden ring-2 ring-white/50">
              {!imageError && team.logo_url ? (
                <Image
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  width={64}
                  height={64}
                  className="object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-bold text-2xl"
                  style={{
                    background: gradient,
                    color: textColor
                  }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Favorite Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle?.(team.id);
              }}
              className={cn(
                'w-10 h-10 rounded-full backdrop-blur-xl',
                'flex items-center justify-center',
                'transition-all duration-300',
                'hover:scale-110',
                isFavorite
                  ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/50'
                  : 'bg-white/20 text-white hover:bg-white/30'
              )}
            >
              <svg
                className="w-5 h-5"
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          </div>

          {/* Middle: Team Info */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">
              {team.name}
            </h3>
            <div className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
              <span className="text-sm font-semibold text-white">
                {team.conference_display_name}
              </span>
            </div>
          </div>

          {/* Bottom: Athlete Count */}
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white drop-shadow-lg">
              {team.athlete_count}
            </span>
            <span className="text-lg font-medium text-white/80">
              athletes
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Commit team card**

Run:
```bash
git add components/TeamCard.tsx
git commit -m "feat: add immersive team card component"
```

---

## Task 8: Athlete Card Component

**Files:**
- Create: `components/AthleteCard.tsx`

**Step 1: Create AthleteCard component**

Create `components/AthleteCard.tsx`:
```typescript
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import { Athlete, Team } from '@/lib/supabase/types';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';

interface AthleteCardProps {
  athlete: Athlete;
  team: Team;
  index: number;
  onFavoriteToggle?: (athleteId: string) => void;
  isFavorite?: boolean;
}

export function AthleteCard({
  athlete,
  team,
  index,
  onFavoriteToggle,
  isFavorite = false
}: AthleteCardProps) {
  const [imageError, setImageError] = useState(false);
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{
        duration: 0.6,
        delay: index * 0.05,
        ease: 'easeOut'
      }}
      className="group relative"
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
        {/* Top Color Accent */}
        <div
          className="h-1"
          style={{ background: team.primary_color }}
        />

        {/* Photo Section */}
        <div
          className="relative h-64 flex items-center justify-center overflow-hidden"
          style={{ background: `linear-gradient(to bottom, ${team.primary_color}15, ${team.secondary_color}10)` }}
        >
          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle?.(athlete.id);
            }}
            className={cn(
              'absolute top-4 right-4 z-10',
              'w-10 h-10 rounded-full backdrop-blur-xl',
              'flex items-center justify-center',
              'transition-all duration-300',
              'hover:scale-110',
              isFavorite
                ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/50'
                : 'bg-white/80 text-gray-700 hover:bg-white'
            )}
          >
            <svg
              className="w-5 h-5"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>

          {/* Athlete Photo */}
          <div className="relative w-44 h-44 rounded-full overflow-hidden shadow-xl ring-4 ring-white">
            {!imageError && athlete.photo_url ? (
              <Image
                src={athlete.photo_url}
                alt={athlete.name}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-4xl font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${team.primary_color}, ${team.secondary_color})` }}
              >
                {athlete.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <h3 className="text-xl font-bold text-gray-900 text-center leading-tight">
            {athlete.name}
          </h3>

          {/* Badges */}
          <div className="flex gap-2 justify-center flex-wrap">
            <Badge variant={athlete.athlete_type === 'swimmer' ? 'swimmer' : 'diver'}>
              {athlete.athlete_type === 'swimmer' ? 'Swimmer' : 'Diver'}
            </Badge>
            <Badge variant={athlete.class_year}>
              {athlete.class_year.charAt(0).toUpperCase() + athlete.class_year.slice(1)}
            </Badge>
          </div>

          {/* Hometown */}
          {athlete.hometown && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="italic">{athlete.hometown}</span>
            </div>
          )}

          {/* View Profile Button */}
          {athlete.profile_url && (
            <Button
              variant="primary"
              size="md"
              className="w-full group/btn"
              style={{
                background: `linear-gradient(135deg, ${team.primary_color}, ${team.secondary_color})`
              }}
              onClick={() => window.open(athlete.profile_url!, '_blank')}
            >
              View Profile
              <svg
                className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Commit athlete card**

Run:
```bash
git add components/AthleteCard.tsx
git commit -m "feat: add athlete card component with team branding"
```

---

## Task 9: Conference Section Component

**Files:**
- Create: `components/ConferenceSection.tsx`

**Step 1: Create ConferenceSection component**

Create `components/ConferenceSection.tsx`:
```typescript
'use client';

import { motion } from 'framer-motion';
import { Team } from '@/lib/supabase/types';
import { TeamCard } from './TeamCard';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';

interface ConferenceSectionProps {
  conferenceName: string;
  conferenceCode: string;
  teams: Team[];
  onFavoriteToggle?: (teamId: string) => void;
  favoriteTeamIds?: Set<string>;
}

export function ConferenceSection({
  conferenceName,
  conferenceCode,
  teams,
  onFavoriteToggle,
  favoriteTeamIds = new Set()
}: ConferenceSectionProps) {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.05 });

  if (teams.length === 0) return null;

  // Get average colors from teams for section background
  const sectionGradient = getConferenceGradient(conferenceCode);

  return (
    <section
      ref={ref}
      className="relative py-20"
      style={{ background: sectionGradient }}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-5xl font-bold text-gray-900 mb-2">
            {conferenceName}
          </h2>
          <p className="text-lg text-gray-600">
            {teams.length} {teams.length === 1 ? 'team' : 'teams'} • {teams.reduce((sum, t) => sum + t.athlete_count, 0)} athletes
          </p>
        </motion.div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team, index) => (
            <TeamCard
              key={team.id}
              team={team}
              index={index}
              onFavoriteToggle={onFavoriteToggle}
              isFavorite={favoriteTeamIds.has(team.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// Helper function to get conference-specific gradients
function getConferenceGradient(conferenceCode: string): string {
  const gradients: Record<string, string> = {
    'sec': 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    'acc': 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    'big-ten': 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
    'big-12': 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
    'ivy': 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    'patriot': 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    'other': 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
  };

  return gradients[conferenceCode] || gradients.other;
}
```

**Step 2: Commit conference section**

Run:
```bash
git add components/ConferenceSection.tsx
git commit -m "feat: add conference section with background gradients"
```

---

## Task 10: Main Page Implementation

**Files:**
- Create: `app/page.tsx`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Modify: `app/favicon.ico`

**Step 1: Update global styles**

Create `app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-inter: 'Inter', system-ui, sans-serif;
    --font-space-grotesk: 'Space Grotesk', system-ui, sans-serif;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-gray-50 text-gray-900;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}

@layer utilities {
  .animate-gradient {
    animation: gradient 15s ease infinite;
    background-size: 200% 200%;
  }

  @keyframes gradient {
    0%, 100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  @apply bg-gray-100;
}

::-webkit-scrollbar-thumb {
  @apply bg-gray-400 rounded-full;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-500;
}
```

**Step 2: Update root layout**

Create `app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'NCAA D1 Men\'s Swimming & Diving Tracker',
  description: 'Track rosters, teams, and athletes across all Division I conferences',
  keywords: ['NCAA', 'Swimming', 'Diving', 'D1', 'College Sports'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Create main page with data fetching**

Create `app/page.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { FilterPills } from '@/components/FilterPills';
import { HeroSection } from '@/components/HeroSection';
import { ConferenceSection } from '@/components/ConferenceSection';
import { TeamCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { supabase } from '@/lib/supabase/client';
import { Team } from '@/lib/supabase/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { formatLastUpdated } from '@/lib/utils';

type ViewMode = 'rosters' | 'teams';
type Conference = 'all' | 'sec' | 'big-ten' | 'acc' | 'big-12' | 'ivy' | 'other';
type AthleteType = 'all' | 'swimmers' | 'divers';

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('teams');
  const [selectedConference, setSelectedConference] = useState<Conference>('all');
  const [selectedAthleteType, setSelectedAthleteType] = useState<AthleteType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteTeamIds, setFavoriteTeamIds] = useLocalStorage<string[]>('favoriteTeams', []);

  // Fetch teams from Supabase
  useEffect(() => {
    async function fetchTeams() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .order('athlete_count', { ascending: false });

        if (error) throw error;
        setTeams(data || []);
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  // Filter teams
  const filteredTeams = teams.filter(team => {
    // Search filter
    if (searchQuery && !team.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Conference filter
    if (selectedConference !== 'all' && team.conference !== selectedConference) {
      return false;
    }

    return true;
  });

  // Group teams by conference
  const conferenceGroups = groupTeamsByConference(filteredTeams);

  // Calculate counts
  const counts = {
    rosters: teams.reduce((sum, t) => sum + t.athlete_count, 0),
    teams: teams.length,
    conferences: {
      all: teams.reduce((sum, t) => sum + t.athlete_count, 0),
      sec: teams.filter(t => t.conference === 'sec').reduce((sum, t) => sum + t.athlete_count, 0),
      'big-ten': teams.filter(t => t.conference === 'big-ten').reduce((sum, t) => sum + t.athlete_count, 0),
      acc: teams.filter(t => t.conference === 'acc').reduce((sum, t) => sum + t.athlete_count, 0),
      'big-12': teams.filter(t => t.conference === 'big-12').reduce((sum, t) => sum + t.athlete_count, 0),
      ivy: teams.filter(t => t.conference === 'ivy').reduce((sum, t) => sum + t.athlete_count, 0),
      other: teams.filter(t => t.conference === 'other').reduce((sum, t) => sum + t.athlete_count, 0),
    },
    athleteTypes: {
      all: teams.reduce((sum, t) => sum + t.athlete_count, 0),
      swimmers: 0, // Would need athlete data
      divers: 0, // Would need athlete data
    },
  };

  const handleFavoriteToggle = (teamId: string) => {
    setFavoriteTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const favoriteTeamIdsSet = new Set(favoriteTeamIds);

  return (
    <main className="min-h-screen">
      <Navigation
        onSearch={setSearchQuery}
        favoriteCount={favoriteTeamIds.length}
        missingDataCount={0}
      />

      <FilterPills
        viewMode={viewMode}
        selectedConference={selectedConference}
        selectedAthleteType={selectedAthleteType}
        onViewModeChange={setViewMode}
        onConferenceChange={setSelectedConference}
        onAthleteTypeChange={setSelectedAthleteType}
        counts={counts}
      />

      <HeroSection
        totalTeams={teams.length}
        totalAthletes={teams.reduce((sum, t) => sum + t.athlete_count, 0)}
        missingData={0}
        lastUpdated={formatLastUpdated(new Date().toISOString())}
      />

      {loading ? (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <TeamCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {Object.entries(conferenceGroups).map(([conference, teams]) => (
            <ConferenceSection
              key={conference}
              conferenceName={getConferenceDisplayName(conference)}
              conferenceCode={conference}
              teams={teams}
              onFavoriteToggle={handleFavoriteToggle}
              favoriteTeamIds={favoriteTeamIdsSet}
            />
          ))}
        </>
      )}
    </main>
  );
}

function groupTeamsByConference(teams: Team[]): Record<string, Team[]> {
  const groups: Record<string, Team[]> = {};

  teams.forEach(team => {
    const conf = team.conference || 'other';
    if (!groups[conf]) {
      groups[conf] = [];
    }
    groups[conf].push(team);
  });

  return groups;
}

function getConferenceDisplayName(code: string): string {
  const names: Record<string, string> = {
    'sec': 'SEC',
    'acc': 'ACC',
    'big-ten': 'Big Ten',
    'big-12': 'Big 12',
    'ivy': 'Ivy League',
    'patriot': 'Patriot League',
    'other': 'Independent & Mid-Major',
  };

  return names[code] || code.toUpperCase();
}
```

**Step 4: Commit main page**

Run:
```bash
git add app/
git commit -m "feat: implement main page with data fetching and filtering"
```

---

## Task 11: Data Migration & Logo Collection

**Files:**
- Create: `scripts/migrate-data.ts`
- Create: `scripts/fetch-logos.ts`
- Create: `public/team-logos/.gitkeep`

**Step 1: Create data migration script**

Create `scripts/migrate-data.ts`:
```typescript
import { supabase } from '../lib/supabase/client';

// Sample team data with proper conference categorization
const teamsData = [
  // SEC
  { name: 'Florida', conference: 'sec', conference_display_name: 'SEC', primary_color: '#0021A5', secondary_color: '#FA4616' },
  { name: 'Texas', conference: 'sec', conference_display_name: 'SEC', primary_color: '#BF5700', secondary_color: '#FFFFFF' },
  { name: 'Alabama', conference: 'sec', conference_display_name: 'SEC', primary_color: '#9E1B32', secondary_color: '#828A8F' },
  { name: 'Auburn', conference: 'sec', conference_display_name: 'SEC', primary_color: '#0C2340', secondary_color: '#E87722' },
  { name: 'Georgia', conference: 'sec', conference_display_name: 'SEC', primary_color: '#BA0C2F', secondary_color: '#000000' },
  { name: 'Tennessee', conference: 'sec', conference_display_name: 'SEC', primary_color: '#FF8200', secondary_color: '#FFFFFF' },
  { name: 'Missouri', conference: 'sec', conference_display_name: 'SEC', primary_color: '#F1B82D', secondary_color: '#000000' },
  { name: 'Kentucky', conference: 'sec', conference_display_name: 'SEC', primary_color: '#0033A0', secondary_color: '#FFFFFF' },
  { name: 'LSU', conference: 'sec', conference_display_name: 'SEC', primary_color: '#461D7C', secondary_color: '#FDD023' },
  { name: 'South Carolina', conference: 'sec', conference_display_name: 'SEC', primary_color: '#73000A', secondary_color: '#000000' },
  { name: 'Texas A&M', conference: 'sec', conference_display_name: 'SEC', primary_color: '#500000', secondary_color: '#FFFFFF' },

  // ACC
  { name: 'Virginia', conference: 'acc', conference_display_name: 'ACC', primary_color: '#232D4B', secondary_color: '#E57200' },
  { name: 'NC State', conference: 'acc', conference_display_name: 'ACC', primary_color: '#CC0000', secondary_color: '#FFFFFF' },
  { name: 'Notre Dame', conference: 'acc', conference_display_name: 'ACC', primary_color: '#0C2340', secondary_color: '#C99700' },
  { name: 'Pittsburgh', conference: 'acc', conference_display_name: 'ACC', primary_color: '#003594', secondary_color: '#FFB81C' },
  { name: 'Louisville', conference: 'acc', conference_display_name: 'ACC', primary_color: '#AD0000', secondary_color: '#000000' },
  { name: 'Virginia Tech', conference: 'acc', conference_display_name: 'ACC', primary_color: '#630031', secondary_color: '#CF4420' },
  { name: 'Florida State', conference: 'acc', conference_display_name: 'ACC', primary_color: '#782F40', secondary_color: '#CEB888' },
  { name: 'Duke', conference: 'acc', conference_display_name: 'ACC', primary_color: '#001A57', secondary_color: '#FFFFFF' },
  { name: 'North Carolina', conference: 'acc', conference_display_name: 'ACC', primary_color: '#13294B', secondary_color: '#7BAFD4' },
  { name: 'Boston College', conference: 'acc', conference_display_name: 'ACC', primary_color: '#8B0015', secondary_color: '#EAAA00' },
  { name: 'Georgia Tech', conference: 'acc', conference_display_name: 'ACC', primary_color: '#B3A369', secondary_color: '#003057' },
  { name: 'Stanford', conference: 'acc', conference_display_name: 'ACC', primary_color: '#8C1515', secondary_color: '#FFFFFF' },
  { name: 'Cal', conference: 'acc', conference_display_name: 'ACC', primary_color: '#003262', secondary_color: '#FDB515' },
  { name: 'SMU', conference: 'acc', conference_display_name: 'ACC', primary_color: '#0033A0', secondary_color: '#CC0035' },

  // Big Ten
  { name: 'Indiana', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#990000', secondary_color: '#FFFFFF' },
  { name: 'Ohio State', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#BB0000', secondary_color: '#666666' },
  { name: 'Michigan', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#00274C', secondary_color: '#FFCB05' },
  { name: 'Penn State', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#041E42', secondary_color: '#FFFFFF' },
  { name: 'Northwestern', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#4E2A84', secondary_color: '#FFFFFF' },
  { name: 'Minnesota', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#7A0019', secondary_color: '#FFCC33' },
  { name: 'Purdue', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#000000', secondary_color: '#CFB991' },
  { name: 'Wisconsin', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#C5050C', secondary_color: '#FFFFFF' },
  { name: 'USC', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#990000', secondary_color: '#FFCC00' },

  // Big 12
  { name: 'Arizona State', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#8C1D40', secondary_color: '#FFC627' },
  { name: 'West Virginia', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#002855', secondary_color: '#EAAA00' },
  { name: 'TCU', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#4D1979', secondary_color: '#A3A9AC' },
  { name: 'Utah', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#CC0000', secondary_color: '#FFFFFF' },
  { name: 'Arizona', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#003366', secondary_color: '#CC0033' },

  // Ivy League
  { name: 'Harvard', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#A51C30', secondary_color: '#FFFFFF' },
  { name: 'Yale', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#00356B', secondary_color: '#FFFFFF' },
  { name: 'Princeton', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#FF8F00', secondary_color: '#000000' },
  { name: 'Columbia', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#B9D9EB', secondary_color: '#FFFFFF' },
  { name: 'Penn', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#011F5B', secondary_color: '#990000' },
  { name: 'Cornell', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#B31B1B', secondary_color: '#FFFFFF' },
  { name: 'Brown', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#4E3629', secondary_color: '#ED1C24' },
  { name: 'Dartmouth', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#00693E', secondary_color: '#FFFFFF' },

  // Patriot League
  { name: 'Navy', conference: 'patriot', conference_display_name: 'Patriot League', primary_color: '#002F5F', secondary_color: '#C99700' },
  { name: 'Army', conference: 'patriot', conference_display_name: 'Patriot League', primary_color: '#000000', secondary_color: '#D4AF37' },

  // Other/Independent
  { name: 'George Washington', conference: 'other', conference_display_name: 'Atlantic 10', primary_color: '#003366', secondary_color: '#AA8960' },
  { name: 'Towson', conference: 'other', conference_display_name: 'Colonial Athletic', primary_color: '#FFBF00', secondary_color: '#000000' },
  { name: 'Southern Illinois', conference: 'other', conference_display_name: 'Missouri Valley', primary_color: '#5C0000', secondary_color: '#FFFFFF' },
  { name: 'UNLV', conference: 'other', conference_display_name: 'Mountain West', primary_color: '#CF0A2C', secondary_color: '#000000' },
];

async function migrateTeams() {
  console.log('Starting team migration...');

  for (const team of teamsData) {
    try {
      const { error } = await supabase
        .from('teams')
        .upsert({
          name: team.name,
          conference: team.conference,
          conference_display_name: team.conference_display_name,
          primary_color: team.primary_color,
          secondary_color: team.secondary_color,
          athlete_count: 0, // Will be updated when athletes are added
        }, {
          onConflict: 'name'
        });

      if (error) {
        console.error(`Error inserting ${team.name}:`, error);
      } else {
        console.log(`✓ Inserted ${team.name}`);
      }
    } catch (err) {
      console.error(`Exception for ${team.name}:`, err);
    }
  }

  console.log('Migration complete!');
}

// Run migration
migrateTeams();
```

**Step 2: Add migration script to package.json**

Add to `package.json` scripts:
```json
"scripts": {
  "migrate": "tsx scripts/migrate-data.ts"
}
```

Install tsx: `npm install -D tsx`

**Step 3: Run migration**

Run: `npm run migrate`

Expected: Teams inserted into Supabase

**Step 4: Commit migration script**

Run:
```bash
git add scripts/ package.json
git commit -m "feat: add data migration script for teams"
```

---

## Task 12: Final Polish & Deployment

**Files:**
- Create: `README.md`
- Create: `vercel.json`
- Modify: `.env.local.example`

**Step 1: Create README**

Create `README.md`:
```markdown
# NCAA D1 Men's Swimming & Diving Tracker

A visually stunning, immersive tracker for NCAA Division I Men's Swimming & Diving teams and athletes.

## Features

- 🏊 Rich, immersive team cards with team color gradients
- 👤 Beautiful athlete profiles with photos and stats
- 🎨 Full-bleed modern design with smooth animations
- 📱 Fully responsive mobile experience
- ⭐ Favorite teams and athletes
- 🔍 Search and filter functionality
- 🎯 Conference-based organization

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
   Add your Supabase credentials

4. Run migrations:
   ```bash
   npm run migrate
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## License

MIT
```

**Step 2: Create Vercel config**

Create `vercel.json`:
```json
{
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

**Step 3: Create env example**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Step 4: Test build**

Run: `npm run build`

Expected: Build succeeds without errors

**Step 5: Final commit**

Run:
```bash
git add README.md vercel.json .env.local.example
git commit -m "docs: add README and deployment configuration"
```

**Step 6: Deploy to Vercel**

Run: `vercel --prod`

Expected: Deployment successful

---

## Plan Complete

The implementation plan is now complete. This plan covers:

1. ✅ Project setup with Next.js, TypeScript, Tailwind CSS
2. ✅ Supabase schema for teams and athletes
3. ✅ Utility functions and custom hooks
4. ✅ Base UI components (Button, Badge, SearchBar, Loading)
5. ✅ Navigation with glassmorphism effect
6. ✅ Hero section with animated gradients
7. ✅ Immersive team cards with color gradients
8. ✅ Athlete cards with team branding
9. ✅ Conference sections with proper organization
10. ✅ Main page with data fetching and filtering
11. ✅ Data migration for proper conference categorization
12. ✅ Deployment configuration

**Key Features Delivered:**
- Rich, immersive UI with team color gradients
- Proper team logo display (with fallbacks)
- Full-bleed modern layout
- Smooth scroll animations
- Conference-based organization
- "Independent & Mid-Major" section for proper categorization
- Mobile-optimized design
- Performance optimizations

**Next Steps After Implementation:**
1. Collect and upload actual team logos
2. Migrate existing athlete data from current site
3. Test on multiple devices and browsers
4. Monitor performance metrics
5. Gather user feedback for iterations
