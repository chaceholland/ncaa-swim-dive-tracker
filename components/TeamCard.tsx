'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Team } from '@/lib/supabase/types';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import {
  getTeamGradient,
  getTeamInitials,
  getContrastColor,
  cn,
} from '@/lib/utils';

interface TeamCardProps {
  team: Team;
  index: number;
  onFavoriteToggle: (teamId: string) => void;
  isFavorite: boolean;
}

export default function TeamCard({
  team,
  index,
  onFavoriteToggle,
  isFavorite,
}: TeamCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Intersection observer for scroll animations
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  // Get team gradient and initials
  const gradient = getTeamGradient(team.primary_color, team.secondary_color);
  const initials = getTeamInitials(team.name);
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
    onFavoriteToggle(team.id);
  };

  // Determine which logo to use
  const logoUrl = imageError ? null : (team.logo_url || team.logo_fallback_url);
  const showInitials = !logoUrl || imageError;

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
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className={cn(
          'relative h-52 rounded-2xl shadow-lg overflow-hidden cursor-pointer',
          'transition-shadow duration-300'
        )}
        whileHover={{
          y: -8,
          scale: 1.02,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: gradient,
          }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30 z-10" />

        {/* Pattern overlay on hover (diagonal stripes) */}
        <motion.div
          className="absolute inset-0 z-10 opacity-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255, 255, 255, 0.03) 10px,
              rgba(255, 255, 255, 0.03) 20px
            )`,
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Content */}
        <div className="relative z-20 h-full p-6 flex flex-col">
          {/* Top section: Logo and Favorite button */}
          <div className="flex justify-between items-start mb-auto">
            {/* Team logo or initials */}
            <div className="relative">
              {showInitials ? (
                // Initials fallback
                <div
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center',
                    'ring-4 ring-white/50 backdrop-blur-sm',
                    'font-bold text-3xl'
                  )}
                  style={{
                    backgroundColor: `#${team.primary_color}`,
                    color: contrastColor,
                  }}
                >
                  {initials}
                </div>
              ) : (
                // Team logo with loading state
                <div className="relative w-20 h-20">
                  <div
                    className={cn(
                      'absolute inset-0 rounded-full bg-white ring-4 ring-white/50',
                      'flex items-center justify-center',
                      imageLoading && 'animate-pulse'
                    )}
                  >
                    {imageLoading && (
                      <div className="text-gray-400 text-xs">Loading...</div>
                    )}
                  </div>
                  {logoUrl && (
                    <Image
                      src={logoUrl}
                      alt={`${team.name} logo`}
                      width={80}
                      height={80}
                      className={cn(
                        'relative rounded-full p-2 bg-white ring-4 ring-white/50',
                        'object-contain transition-opacity duration-300',
                        imageLoading ? 'opacity-0' : 'opacity-100'
                      )}
                      onError={handleImageError}
                      onLoad={handleImageLoad}
                      priority={index < 6} // Priority load first 6 images
                    />
                  )}
                </div>
              )}
            </div>

            {/* Favorite button */}
            <motion.button
              onClick={handleFavoriteClick}
              className={cn(
                'p-2 rounded-full backdrop-blur-sm transition-colors',
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
          </div>

          {/* Center section: Team name and conference */}
          <div className="flex flex-col items-start space-y-2 mb-auto">
            <h3 className="text-2xl font-bold text-white leading-tight">
              {team.name}
            </h3>

            {/* Conference badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
              <span className="text-sm font-medium text-white">
                {team.conference_display_name}
              </span>
            </div>
          </div>

          {/* Bottom section: Athlete count */}
          <div className="flex flex-col items-start">
            <motion.div
              className="text-4xl font-bold text-white"
              animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {team.athlete_count}
            </motion.div>
            <div className="text-sm text-white/80 font-medium">
              {team.athlete_count === 1 ? 'athlete' : 'athletes'}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
