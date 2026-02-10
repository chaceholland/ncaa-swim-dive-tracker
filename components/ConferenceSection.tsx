'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Team } from '@/lib/supabase/types';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import TeamCard from '@/components/TeamCard';

interface ConferenceSectionProps {
  conferenceName: string;
  conferenceCode: string;
  teams: Team[];
  onFavoriteToggle: (teamId: string) => void;
  favoriteTeamIds: Set<string>;
}

/**
 * Get conference-specific gradient background
 * @param conferenceCode - Conference code (e.g., 'SEC', 'ACC')
 * @returns CSS gradient string
 */
function getConferenceGradient(conferenceCode: string): string {
  const gradients: Record<string, string> = {
    SEC: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)', // Blue gradient
    ACC: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fde047 100%)', // Yellow gradient
    'Big Ten': 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ef4444 100%)', // Red gradient
    'Big 12': 'linear-gradient(135deg, #6b21a8 0%, #9333ea 50%, #a855f7 100%)', // Purple gradient
    Ivy: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)', // Green gradient
    Patriot: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)', // Blue gradient
  };

  // Return conference gradient or default gray gradient
  return (
    gradients[conferenceCode] ||
    'linear-gradient(135deg, #374151 0%, #6b7280 50%, #9ca3af 100%)' // Gray gradient
  );
}

export default function ConferenceSection({
  conferenceName,
  conferenceCode,
  teams,
  onFavoriteToggle,
  favoriteTeamIds,
}: ConferenceSectionProps) {
  // Return null if teams array is empty
  if (!teams || teams.length === 0) {
    return null;
  }

  // Intersection observer for header animations
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  // Calculate total athlete count
  const totalAthletes = useMemo(() => {
    return teams.reduce((sum, team) => sum + team.athlete_count, 0);
  }, [teams]);

  // Get conference gradient
  const conferenceGradient = getConferenceGradient(conferenceCode);

  return (
    <section
      className="w-full py-20"
      style={{
        background: conferenceGradient,
      }}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          ref={ref as React.RefObject<HTMLDivElement>}
          initial={{ opacity: 0, y: 20 }}
          animate={
            isIntersecting
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 20 }
          }
          transition={{
            duration: 0.6,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          className="mb-12 text-center"
        >
          <h2 className="text-5xl font-bold text-white mb-4">
            {conferenceName}
          </h2>
          <p className="text-xl text-white/80 font-medium">
            {teams.length} {teams.length === 1 ? 'team' : 'teams'} &middot;{' '}
            {totalAthletes} {totalAthletes === 1 ? 'athlete' : 'athletes'}
          </p>
        </motion.div>

        {/* Teams grid */}
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
