'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Team } from '@/lib/supabase/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { formatLastUpdated } from '@/lib/utils';
import Navigation from '@/components/Navigation';
import FilterPills, {
  ViewMode,
  Conference,
  AthleteType,
  FilterCounts,
} from '@/components/FilterPills';
import HeroSection from '@/components/HeroSection';
import ConferenceSection from '@/components/ConferenceSection';

/**
 * Group teams by conference
 */
function groupTeamsByConference(
  teams: Team[]
): Record<string, Team[]> {
  return teams.reduce((acc, team) => {
    const conf = team.conference || 'other';
    if (!acc[conf]) {
      acc[conf] = [];
    }
    acc[conf].push(team);
    return acc;
  }, {} as Record<string, Team[]>);
}

/**
 * Get user-friendly conference display name
 */
function getConferenceDisplayName(conferenceCode: string): string {
  const displayNames: Record<string, string> = {
    'sec': 'SEC',
    'big-ten': 'Big Ten',
    'acc': 'ACC',
    'big-12': 'Big 12',
    'ivy': 'Ivy League',
    'patriot': 'Patriot League',
    'other': 'Other Conferences',
  };
  return displayNames[conferenceCode.toLowerCase()] || conferenceCode;
}

/**
 * Loading skeleton for team cards
 */
function TeamCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
      <div className="h-48 bg-slate-200" />
      <div className="p-6 space-y-4">
        <div className="h-6 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-8 bg-slate-200 rounded w-20" />
          <div className="h-8 bg-slate-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for conference section
 */
function ConferenceSectionSkeleton() {
  return (
    <section className="w-full py-20 bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center animate-pulse">
          <div className="h-12 bg-slate-300 rounded w-64 mx-auto mb-4" />
          <div className="h-6 bg-slate-300 rounded w-48 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <TeamCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('rosters');
  const [selectedConference, setSelectedConference] = useState<Conference>('all');
  const [selectedAthleteType, setSelectedAthleteType] = useState<AthleteType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteTeamIds, setFavoriteTeamIds] = useLocalStorage<string[]>('favorite-teams', []);

  // Fetch teams from Supabase
  useEffect(() => {
    async function fetchTeams() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .gt('athlete_count', 0)
          .order('athlete_count', { ascending: false });

        if (error) {
          console.error('Error fetching teams:', error);
          return;
        }

        setTeams(data || []);
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  // Filter teams based on search and filters
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = team.name.toLowerCase().includes(query);
        const matchesConference = team.conference.toLowerCase().includes(query);
        if (!matchesName && !matchesConference) {
          return false;
        }
      }

      // Conference filter
      if (selectedConference !== 'all') {
        const teamConf = team.conference.toLowerCase().replace(/\s+/g, '-');
        if (teamConf !== selectedConference) {
          return false;
        }
      }

      // Note: Athlete type filter would require athlete data
      // For now, we'll include all teams regardless of athlete type

      return true;
    });
  }, [teams, searchQuery, selectedConference, selectedAthleteType]);

  // Group filtered teams by conference
  const groupedTeams = useMemo(() => {
    return groupTeamsByConference(filteredTeams);
  }, [filteredTeams]);

  // Calculate filter counts
  const filterCounts = useMemo((): FilterCounts => {
    const counts: FilterCounts = {
      viewMode: {
        rosters: teams.length,
        teams: teams.length,
      },
      conference: {
        all: teams.length,
        sec: 0,
        'big-ten': 0,
        acc: 0,
        'big-12': 0,
        ivy: 0,
        other: 0,
      },
      athleteType: {
        all: teams.reduce((sum, t) => sum + t.athlete_count, 0),
        swimmers: 0, // Would need athlete data
        divers: 0,   // Would need athlete data
      },
    };

    // Count teams by conference
    teams.forEach((team) => {
      const conf = team.conference.toLowerCase().replace(/\s+/g, '-');
      if (conf === 'sec') counts.conference.sec++;
      else if (conf === 'big-ten') counts.conference['big-ten']++;
      else if (conf === 'acc') counts.conference.acc++;
      else if (conf === 'big-12') counts.conference['big-12']++;
      else if (conf === 'ivy' || conf === 'ivy-league') counts.conference.ivy++;
      else counts.conference.other++;
    });

    return counts;
  }, [teams]);

  // Handle favorite toggle
  const handleFavoriteToggle = (teamId: string) => {
    setFavoriteTeamIds((prev) => {
      if (prev.includes(teamId)) {
        return prev.filter((id) => id !== teamId);
      }
      return [...prev, teamId];
    });
  };

  // Handle favorites view
  const handleFavoritesClick = () => {
    // TODO: Implement favorites modal/view
    console.log('Favorites clicked:', favoriteTeamIds);
  };

  // Handle missing data view
  const handleMissingDataClick = () => {
    // TODO: Implement missing data modal/view
    console.log('Missing data clicked');
  };

  // Convert favoriteTeamIds array to Set for faster lookups
  const favoriteTeamIdsSet = useMemo(() => {
    return new Set(favoriteTeamIds);
  }, [favoriteTeamIds]);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <Navigation
        onSearch={setSearchQuery}
        favoritesCount={favoriteTeamIds.length}
        onFavoritesClick={handleFavoritesClick}
        onMissingDataClick={handleMissingDataClick}
      />

      {/* Filter Pills */}
      <FilterPills
        viewMode={viewMode}
        conference={selectedConference}
        athleteType={selectedAthleteType}
        counts={filterCounts}
        onViewModeChange={setViewMode}
        onConferenceChange={setSelectedConference}
        onAthleteTypeChange={setSelectedAthleteType}
      />

      {/* Hero Section */}
      <HeroSection />

      {/* Conference Sections */}
      {loading ? (
        // Loading skeletons
        <>
          <ConferenceSectionSkeleton />
          <ConferenceSectionSkeleton />
          <ConferenceSectionSkeleton />
        </>
      ) : (
        // Render conference sections
        Object.entries(groupedTeams)
          .sort(([confA], [confB]) => {
            // Sort conferences by priority
            const priority: Record<string, number> = {
              'sec': 1,
              'big-ten': 2,
              'acc': 3,
              'big-12': 4,
              'ivy': 5,
              'patriot': 6,
              'other': 99,
            };
            const prioA = priority[confA.toLowerCase()] || 50;
            const prioB = priority[confB.toLowerCase()] || 50;
            return prioA - prioB;
          })
          .map(([conferenceCode, conferenceTeams]) => (
            <ConferenceSection
              key={conferenceCode}
              conferenceName={getConferenceDisplayName(conferenceCode)}
              conferenceCode={conferenceCode}
              teams={conferenceTeams}
              onFavoriteToggle={handleFavoriteToggle}
              favoriteTeamIds={favoriteTeamIdsSet}
            />
          ))
      )}

      {/* Empty state */}
      {!loading && filteredTeams.length === 0 && (
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <svg
              className="w-24 h-24 mx-auto mb-6 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h.01M12 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-2xl font-bold text-slate-700 mb-2">
              No teams found
            </h3>
            <p className="text-slate-500 mb-6">
              Try adjusting your filters or search query
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedConference('all');
                setSelectedAthleteType('all');
              }}
              className="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-full font-medium hover:shadow-lg transition-all"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
