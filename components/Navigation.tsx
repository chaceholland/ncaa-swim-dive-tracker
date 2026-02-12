'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import SearchBar from '@/components/ui/SearchBar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

export interface NavigationProps {
  onSearch: (query: string) => void;
  favoritesCount: number;
  onFavoritesClick: () => void;
  onMissingDataClick: () => void;
  issuesCount?: number;
}

/**
 * Navigation component with glassmorphism effect and responsive layout
 * Features scroll detection, search bar, favorites, and missing data buttons
 */
export default function Navigation({
  onSearch,
  favoritesCount,
  onFavoritesClick,
  onMissingDataClick,
  issuesCount = 0,
}: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        'backdrop-blur-xl bg-white/80',
        isScrolled && 'shadow-lg shadow-slate-900/10'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main navigation bar */}
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <div className="flex items-center gap-3">
            <div className="text-primary">
              <svg
                className="h-8 w-8"
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
                  d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              NCAA Swim & Dive
            </h1>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search Bar */}
            <div className="w-64 lg:w-80">
              <SearchBar
                onSearch={onSearch}
                placeholder="Search athletes..."
                className="bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-500"
              />
            </div>

            {/* Missing Data Button */}
            <Button
              variant={issuesCount > 0 ? "primary" : "outline"}
              size="sm"
              onClick={onMissingDataClick}
              className={cn(
                "hidden lg:flex relative",
                issuesCount > 0
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100"
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="ml-2">Data Issues</span>
              {issuesCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 bg-white/20 text-white border-white/30"
                >
                  {issuesCount}
                </Badge>
              )}
            </Button>

            {/* Favorites Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={onFavoritesClick}
              className="relative"
            >
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
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span className="ml-2">Favorites</span>
              {favoritesCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 bg-white/20 text-white border-white/30"
                >
                  {favoritesCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            {/* Favorites Button - Mobile */}
            <Button
              variant="primary"
              size="sm"
              onClick={onFavoritesClick}
              className="relative"
            >
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
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {favoritesCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 bg-white/20 text-white border-white/30"
                >
                  {favoritesCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Search Bar - Below main nav */}
        <div className="md:hidden pb-3">
          <SearchBar
            onSearch={onSearch}
            placeholder="Search athletes..."
            className="bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-500"
          />
        </div>
      </div>
    </nav>
  );
}
