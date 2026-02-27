'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { isExternalUrl } from '@/lib/image-utils';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import type { Athlete, Team } from '@/lib/supabase/types';

export interface NavigationProps {
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
  favoritesCount,
  onFavoritesClick,
  onMissingDataClick,
  issuesCount = 0,
}: NavigationProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [athleteResults, setAthleteResults] = useState<Pick<Athlete, 'id' | 'name' | 'photo_url' | 'class_year' | 'athlete_type' | 'team_id'>[]>([]);
  const [teamResults, setTeamResults] = useState<Pick<Team, 'id' | 'name' | 'logo_url' | 'conference_display_name'>[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (!dropdownQuery.trim() || dropdownQuery.length < 2) {
      setAthleteResults([]);
      setTeamResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      const q = `%${dropdownQuery.trim()}%`;
      const [{ data: athletes }, { data: teams }] = await Promise.all([
        supabase
          .from('athletes')
          .select('id, name, photo_url, class_year, athlete_type, team_id')
          .ilike('name', q)
          .limit(5),
        supabase
          .from('teams')
          .select('id, name, logo_url, conference_display_name')
          .ilike('name', q)
          .limit(3),
      ]);
      setAthleteResults(athletes || []);
      setTeamResults(teams || []);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [dropdownQuery]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
            {/* Search Bar with Dropdown */}
            <div ref={dropdownRef} className="relative w-64 lg:w-80">
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
                  value={dropdownQuery}
                  onChange={(e) => setDropdownQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dropdownQuery.trim()) {
                      router.push(`/search?q=${encodeURIComponent(dropdownQuery.trim())}`);
                      setShowDropdown(false);
                      setDropdownQuery('');
                    } else if (e.key === 'Escape') {
                      setShowDropdown(false);
                    }
                  }}
                  placeholder="Search athletes or teams..."
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-lg',
                    'text-slate-900 placeholder:text-slate-500',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                    'transition-all duration-200'
                  )}
                  aria-label="Search"
                />
              </div>

              {/* Dropdown Results */}
              {showDropdown && (athleteResults.length > 0 || teamResults.length > 0) && (
                <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
                  {/* Teams Section */}
                  {teamResults.length > 0 && (
                    <div className="border-b border-slate-100">
                      <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Teams
                      </div>
                      {teamResults.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => {
                            router.push(`/team/${team.id}`);
                            setShowDropdown(false);
                            setDropdownQuery('');
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          {team.logo_url ? (
                            <Image
                              src={team.logo_url}
                              alt={team.name}
                              width={32}
                              height={32}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                              <span className="text-slate-600 text-sm font-semibold">
                                {team.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">{team.name}</div>
                            <div className="text-xs text-slate-500">{team.conference_display_name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Athletes Section */}
                  {athleteResults.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Athletes
                      </div>
                      {athleteResults.map((athlete) => (
                        <button
                          key={athlete.id}
                          onClick={() => {
                            router.push(`/athlete/${athlete.id}`);
                            setShowDropdown(false);
                            setDropdownQuery('');
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          {athlete.photo_url ? (
                            // Check if externally optimized to bypass Vercel Image Optimization
                            (athlete.photo_url.includes('/render/image/') ||
                             athlete.photo_url.includes('supabase.co/storage') ||
                             athlete.photo_url.includes('sidearmdev.com') ||
                             athlete.photo_url.includes('cloudfront.net') ||
                             athlete.photo_url.includes('/imgproxy/') ||
                             athlete.photo_url.includes('storage.googleapis.com') ||
                             (athlete.photo_url.startsWith('http') &&
                              (athlete.photo_url.includes('?width=') || athlete.photo_url.includes('&width=') ||
                               athlete.photo_url.includes('?height=') || athlete.photo_url.includes('&height=')))) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={athlete.photo_url}
                                alt={athlete.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <Image
                                src={athlete.photo_url}
                                alt={athlete.name}
                                width={40}
                                height={40}
                                className="rounded-full object-cover"
                              />
                            )
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                              <span className="text-slate-600 text-sm font-semibold">
                                {athlete.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">{athlete.name}</div>
                            <div className="text-xs text-slate-500 capitalize">
                              {athlete.class_year} • {athlete.athlete_type}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* View all results button */}
                  <button
                    className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors border-t border-gray-100"
                    onClick={() => {
                      router.push(`/search?q=${encodeURIComponent(dropdownQuery)}`);
                      setShowDropdown(false);
                    }}
                  >
                    View all results for &quot;{dropdownQuery}&quot; →
                  </button>
                </div>
              )}
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
          <div ref={dropdownRef} className="relative">
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
                value={dropdownQuery}
                onChange={(e) => setDropdownQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && dropdownQuery.trim()) {
                    router.push(`/search?q=${encodeURIComponent(dropdownQuery.trim())}`);
                    setShowDropdown(false);
                    setDropdownQuery('');
                  } else if (e.key === 'Escape') {
                    setShowDropdown(false);
                  }
                }}
                placeholder="Search athletes or teams..."
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-lg',
                  'text-slate-900 placeholder:text-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  'transition-all duration-200'
                )}
                aria-label="Search"
              />
            </div>

            {/* Dropdown Results */}
            {showDropdown && (athleteResults.length > 0 || teamResults.length > 0) && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
                {/* Teams Section */}
                {teamResults.length > 0 && (
                  <div className="border-b border-slate-100">
                    <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Teams
                    </div>
                    {teamResults.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => {
                          router.push(`/team/${team.id}`);
                          setShowDropdown(false);
                          setDropdownQuery('');
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                      >
                        {team.logo_url ? (
                          <Image
                            src={team.logo_url}
                            alt={team.name}
                            width={32}
                            height={32}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                            <span className="text-slate-600 text-sm font-semibold">
                              {team.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">{team.name}</div>
                          <div className="text-xs text-slate-500">{team.conference_display_name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Athletes Section */}
                {athleteResults.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Athletes
                    </div>
                    {athleteResults.map((athlete) => (
                      <button
                        key={athlete.id}
                        onClick={() => {
                          router.push(`/athlete/${athlete.id}`);
                          setShowDropdown(false);
                          setDropdownQuery('');
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                      >
                        {athlete.photo_url ? (
                          isExternalUrl(athlete.photo_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={athlete.photo_url}
                              alt={athlete.name}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <Image
                              src={athlete.photo_url}
                              alt={athlete.name}
                              width={40}
                              height={40}
                              className="rounded-full object-cover"
                            />
                          )
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                            <span className="text-slate-600 text-sm font-semibold">
                              {athlete.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">{athlete.name}</div>
                          <div className="text-xs text-slate-500 capitalize">
                            {athlete.class_year} • {athlete.athlete_type}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* View all results button */}
                <button
                  className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 font-medium transition-colors border-t border-gray-100"
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(dropdownQuery)}`);
                    setShowDropdown(false);
                  }}
                >
                  View all results for &quot;{dropdownQuery}&quot; →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
