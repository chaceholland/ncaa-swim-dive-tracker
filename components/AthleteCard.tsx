'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Athlete, Team } from '@/lib/supabase/types';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { getTeamGradient, getContrastColor, cn } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface AthleteCardProps {
  athlete: Athlete;
  team: Team;
  index: number;
  onFavoriteToggle: (athleteId: string) => void;
  isFavorite: boolean;
}

/**
 * Extract 1-2 letter initials from athlete name
 * @param name - Full athlete name
 * @returns Initials (1-2 uppercase letters)
 */
function getAthleteInitials(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'A';
  }

  const cleaned = name.trim();

  if (cleaned.length === 0) {
    return 'A';
  }

  // Split by spaces and filter out empty strings
  const words = cleaned.split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return cleaned.charAt(0).toUpperCase();
  }

  if (words.length === 1) {
    // Single word: take first letter
    return words[0].charAt(0).toUpperCase();
  }

  // Multiple words: take first letter of first and last word
  const firstInitial = words[0].charAt(0);
  const lastInitial = words[words.length - 1].charAt(0);
  return (firstInitial + lastInitial).toUpperCase();
}

export default function AthleteCard({
  athlete,
  team,
  index,
  onFavoriteToggle,
  isFavorite,
}: AthleteCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Intersection observer for scroll animations
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  // Get team gradient and initials
  const gradient = getTeamGradient(team.primary_color, team.secondary_color);
  const initials = getAthleteInitials(athlete.name);
  const contrastColor = getContrastColor(team.primary_color);

  // Calculate stagger delay (index * 0.05s = index * 50ms)
  const staggerDelay = index * 0.05;

  // Handle image error
  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  // Handle image load
  const handleImageLoad = () => {
    setImageLoading(false);
  };

  // Handle favorite toggle
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFavoriteToggle(athlete.id);
  };

  // Determine whether to show photo or initials
  const showPhoto = athlete.photo_url && !imageError;

  // Format class year for display
  const formatClassYear = (year: string): string => {
    return year.charAt(0).toUpperCase() + year.slice(1);
  };

  // Format athlete type for display
  const formatAthleteType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <motion.div
      ref={ref as React.RefObject<HTMLDivElement>}
      initial={{ opacity: 0, y: 20 }}
      animate={
        isIntersecting
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 20 }
      }
      transition={{
        duration: 0.5,
        delay: staggerDelay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="relative cursor-pointer"
      onClick={() => router.push(`/athlete/${athlete.id}`)}
    >
      <div className="w-[280px] h-[380px] bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col">
        {/* Team color accent bar */}
        <div
          className="h-1 w-full"
          style={{
            backgroundColor: `#${team.primary_color}`,
          }}
        />

        {/* Photo section with gradient background */}
        <div
          className="relative flex-shrink-0 h-48 flex items-center justify-center"
          style={{
            background: gradient,
          }}
        >
          {/* Favorite button */}
          <motion.button
            onClick={handleFavoriteClick}
            className={cn(
              'absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-colors z-10',
              'focus:outline-none focus:ring-2 focus:ring-white/50',
              isFavorite
                ? 'bg-white/20 text-yellow-400'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <motion.div
              animate={isFavorite ? { rotate: [0, -10, 10, -10, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              <svg
                className={cn('w-5 h-5', isFavorite && 'fill-current')}
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </motion.div>
          </motion.button>

          {/* Photo or initials */}
          <div className="relative">
            {showPhoto ? (
              // Athlete photo with loading state
              <div className="relative w-44 h-44">
                <div
                  className={cn(
                    'absolute inset-0 rounded-full bg-white ring-4 ring-white',
                    'flex items-center justify-center',
                    imageLoading && 'animate-pulse'
                  )}
                >
                  {imageLoading && (
                    <div className="text-gray-400 text-xs">Loading...</div>
                  )}
                </div>
                <Image
                  src={athlete.photo_url!}
                  alt={`${athlete.name}`}
                  width={176}
                  height={176}
                  className={cn(
                    'relative rounded-full ring-4 ring-white',
                    'object-cover transition-opacity duration-300',
                    imageLoading ? 'opacity-0' : 'opacity-100'
                  )}
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                  priority={index < 6} // Priority load first 6 images
                />
              </div>
            ) : (
              // Initials fallback
              <div
                className={cn(
                  'w-44 h-44 rounded-full flex items-center justify-center',
                  'ring-4 ring-white',
                  'font-bold text-5xl'
                )}
                style={{
                  backgroundColor: `#${team.primary_color}`,
                  color: contrastColor,
                }}
              >
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* Info section */}
        <div className="flex-1 bg-white px-6 py-4 flex flex-col">
          {/* Name */}
          <h3 className="text-xl font-bold text-center text-gray-900 mb-3 leading-tight">
            {athlete.name}
          </h3>

          {/* Badges */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <Badge variant={athlete.athlete_type}>
              {formatAthleteType(athlete.athlete_type)}
            </Badge>
            <Badge variant={athlete.class_year}>
              {formatClassYear(athlete.class_year)}
            </Badge>
          </div>

          {/* Hometown */}
          {athlete.hometown && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-gray-600 mb-4">
              <svg
                className="w-4 h-4"
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
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{athlete.hometown}</span>
            </div>
          )}

          {/* View Profile button */}
          <div className="mt-auto">
            <Button
              size="sm"
              className="w-full"
              style={{
                background: gradient,
                color: 'white',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (athlete.profile_url) {
                  window.open(athlete.profile_url, '_blank', 'noopener,noreferrer');
                }
              }}
              disabled={!athlete.profile_url}
            >
              View Profile
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
