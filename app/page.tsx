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

type DataQualityIssue = {
  athleteId: string;
  issues: string[];
  customNote?: string;
};

export default function Home() {
  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('rosters');
  const [selectedConference, setSelectedConference] = useState<Conference>('all');
  const [selectedAthleteType, setSelectedAthleteType] = useState<AthleteType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteTeamIds, setFavoriteTeamIds] = useLocalStorage<string[]>('favorite-teams', []);
  const [dataQualityIssues, setDataQualityIssues] = useLocalStorage<DataQualityIssue[]>('data-quality-issues', []);
  const [showIssuesModal, setShowIssuesModal] = useState(false);

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
    setShowIssuesModal(true);
  };

  // Copy issues to clipboard
  const handleCopyIssues = async () => {
    if (dataQualityIssues.length === 0) {
      alert('No issues to copy');
      return;
    }

    // Fetch all athletes with issues
    const athleteIds = dataQualityIssues.map(issue => issue.athleteId);
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, team_id')
      .in('id', athleteIds);

    if (!athletes) return;

    // Fetch team names
    const teamIds = [...new Set(athletes.map(a => a.team_id))];
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    const teamMap = new Map(teamsData?.map(t => [t.id, t.name]) || []);

    const issueReport = dataQualityIssues
      .map(issue => {
        const athlete = athletes.find(a => a.id === issue.athleteId);
        if (!athlete) return null;

        const teamName = teamMap.get(athlete.team_id) || 'Unknown Team';
        const issueText = issue.issues.join(', ');
        const customText = issue.customNote ? ` - ${issue.customNote}` : '';
        return `${athlete.name} (${teamName}): ${issueText}${customText}`;
      })
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(issueReport);
      alert(`Copied ${dataQualityIssues.length} issues to clipboard!`);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy issues');
    }
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
        issuesCount={dataQualityIssues.length}
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

      {/* Data Quality Issues Modal */}
      {showIssuesModal && (
        <DataQualityModal
          issues={dataQualityIssues}
          onClose={() => setShowIssuesModal(false)}
          onCopyIssues={handleCopyIssues}
          teams={teams}
        />
      )}
    </main>
  );
}

// Data Quality Issues Modal Component
function DataQualityModal({
  issues,
  onClose,
  onCopyIssues,
  teams,
}: {
  issues: DataQualityIssue[];
  onClose: () => void;
  onCopyIssues: () => void;
  teams: Team[];
}) {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAthletes() {
      if (issues.length === 0) {
        setLoading(false);
        return;
      }

      const athleteIds = issues.map(issue => issue.athleteId);
      const { data } = await supabase
        .from('athletes')
        .select('id, name, team_id, photo_url')
        .in('id', athleteIds);

      setAthletes(data || []);
      setLoading(false);
    }

    fetchAthletes();
  }, [issues]);

  const teamMap = new Map(teams.map(t => [t.id, t]));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-orange-50 to-red-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Data Quality Issues</h2>
            <p className="text-sm text-slate-600 mt-1">{issues.length} athletes with reported issues</p>
          </div>
          <div className="flex gap-2">
            {issues.length > 0 && (
              <button
                onClick={onCopyIssues}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy All Issues
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">Loading issues...</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Issues Reported</h3>
              <p className="text-slate-600">All athletes have clean data quality</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {athletes.map(athlete => {
                const issue = issues.find(i => i.athleteId === athlete.id);
                const team = teamMap.get(athlete.team_id);

                return (
                  <div key={athlete.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                        {athlete.photo_url ? (
                          <img src={athlete.photo_url} alt={athlete.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-400">
                            {athlete.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{athlete.name}</h3>
                        <p className="text-sm text-slate-600 truncate">{team?.name || 'Unknown Team'}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {issue?.issues.map((issueType, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded"
                            >
                              {issueType}
                            </span>
                          ))}
                        </div>
                        {issue?.customNote && (
                          <p className="mt-2 text-xs text-slate-600 italic">{issue.customNote}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
