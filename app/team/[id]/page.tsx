'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Team, Athlete } from '@/lib/supabase/types';
import { getTeamGradient, getTeamInitials } from '@/lib/utils';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import Image from 'next/image';
import { motion } from 'framer-motion';

type DataQualityIssue = {
  athleteId: string;
  issues: string[];
  customNote?: string;
};

export default function TeamRosterPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteAthleteIds, setFavoriteAthleteIds] = useLocalStorage<string[]>('favorite-athletes', []);
  const [dataQualityIssues, setDataQualityIssues] = useLocalStorage<DataQualityIssue[]>('data-quality-issues', []);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  useEffect(() => {
    async function fetchTeamAndAthletes() {
      if (!params.id) return;

      try {
        // Fetch team details
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', params.id)
          .single();

        if (teamError) throw teamError;
        setTeam(teamData);

        // Fetch athletes for this team
        const { data: athletesData, error: athletesError } = await supabase
          .from('athletes')
          .select('*')
          .eq('team_id', params.id)
          .order('name');

        if (athletesError) throw athletesError;
        setAthletes(athletesData || []);
      } catch (error) {
        console.error('Error fetching team data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamAndAthletes();
  }, [params.id]);

  // Convert arrays to Sets for faster lookups
  const favoriteAthleteIdsSet = useMemo(() => {
    return new Set(favoriteAthleteIds);
  }, [favoriteAthleteIds]);

  const dataQualityIssuesMap = useMemo(() => {
    const map = new Map<string, DataQualityIssue>();
    dataQualityIssues.forEach(issue => {
      map.set(issue.athleteId, issue);
    });
    return map;
  }, [dataQualityIssues]);

  // Handle favorite toggle
  const handleFavoriteToggle = (athleteId: string) => {
    setFavoriteAthleteIds(prev => {
      if (prev.includes(athleteId)) {
        return prev.filter(id => id !== athleteId);
      } else {
        return [...prev, athleteId];
      }
    });
  };

  // Handle data quality issue toggle
  const handleIssueToggle = (athleteId: string, selectedIssues: string[], customNote?: string) => {
    setDataQualityIssues(prev => {
      const existing = prev.find(issue => issue.athleteId === athleteId);

      if (selectedIssues.length === 0 && !customNote) {
        // Remove if no issues selected
        return prev.filter(issue => issue.athleteId !== athleteId);
      }

      if (existing) {
        // Update existing
        return prev.map(issue =>
          issue.athleteId === athleteId
            ? { athleteId, issues: selectedIssues, customNote }
            : issue
        );
      } else {
        // Add new
        return [...prev, { athleteId, issues: selectedIssues, customNote }];
      }
    });
  };

  // Copy issues to clipboard
  const handleCopyIssues = async () => {
    const issueReport = dataQualityIssues
      .map(issue => {
        const athlete = athletes.find(a => a.id === issue.athleteId);
        if (!athlete) return null;

        const issueText = issue.issues.join(', ');
        const customText = issue.customNote ? ` - ${issue.customNote}` : '';
        return `${athlete.name} (${team?.name}): ${issueText}${customText}`;
      })
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(issueReport);
      alert('Issues copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Filter athletes
  const displayedAthletes = useMemo(() => {
    if (showIssuesOnly) {
      return athletes.filter(athlete => dataQualityIssuesMap.has(athlete.id));
    }
    return athletes;
  }, [athletes, showIssuesOnly, dataQualityIssuesMap]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading roster...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Team not found</h1>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to teams
          </button>
        </div>
      </div>
    );
  }

  const gradient = getTeamGradient(team.primary_color, team.secondary_color);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div
        className="relative h-64 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${team.primary_color}, ${team.secondary_color})`,
        }}
      >
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
          <button
            onClick={() => router.back()}
            className="absolute top-6 left-6 text-white/80 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Teams
          </button>

          <div className="flex items-center gap-6 mt-12">
            {/* Team Logo */}
            <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center shadow-2xl overflow-hidden flex-shrink-0">
              {team.logo_url ? (
                <Image
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  width={128}
                  height={128}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-5xl font-bold" style={{ color: team.primary_color }}>
                  {getTeamInitials(team.name)}
                </span>
              )}
            </div>

            {/* Team Info */}
            <div className="text-white">
              <h1 className="text-5xl font-bold mb-2">{team.name}</h1>
              <p className="text-xl text-white/90">{team.conference_display_name}</p>
              <p className="text-lg text-white/80 mt-2">{team.athlete_count} Athletes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Roster</h2>

          <div className="flex items-center gap-4">
            {dataQualityIssues.length > 0 && (
              <>
                <button
                  onClick={() => setShowIssuesOnly(!showIssuesOnly)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    showIssuesOnly
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {showIssuesOnly ? 'Show All' : `Show Issues (${dataQualityIssues.length})`}
                </button>
                <button
                  onClick={handleCopyIssues}
                  className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Copy Issues
                </button>
              </>
            )}
          </div>
        </div>

        {displayedAthletes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 text-lg">No athletes found for this team.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedAthletes.map((athlete, index) => {
              const isFavorite = favoriteAthleteIdsSet.has(athlete.id);
              const hasIssue = dataQualityIssuesMap.has(athlete.id);
              const issueData = dataQualityIssuesMap.get(athlete.id);

              return (
              <motion.div
                key={athlete.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Athlete Photo */}
                <div className="relative h-64 bg-slate-100">
                  {athlete.photo_url ? (
                    <Image
                      src={athlete.photo_url}
                      alt={athlete.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      unoptimized={athlete.photo_url.includes('auburntigers.com')}
                    />
                  ) : team.logo_url ? (
                    <div
                      className="w-full h-full flex items-center justify-center p-8"
                      style={{
                        background: `linear-gradient(135deg, ${team.primary_color}, ${team.secondary_color})`,
                      }}
                    >
                      <Image
                        src={team.logo_url}
                        alt={team.name}
                        width={120}
                        height={120}
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-6xl font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${team.primary_color}, ${team.secondary_color})`,
                      }}
                    >
                      {athlete.name.charAt(0)}
                    </div>
                  )}

                  {/* Athlete Type Badge */}
                  {athlete.athlete_type && (
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                          athlete.athlete_type === 'diver' ? 'bg-blue-600' : 'bg-emerald-600'
                        }`}
                      >
                        {athlete.athlete_type === 'diver' ? 'Diver' : 'Swimmer'}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    {/* Favorite Button */}
                    <motion.button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFavoriteToggle(athlete.id);
                      }}
                      className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
                        isFavorite
                          ? 'bg-white/90 text-yellow-500'
                          : 'bg-black/30 text-white hover:bg-black/50'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
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
                    </motion.button>

                    {/* Report Issue Button */}
                    <IssueButton
                      athleteId={athlete.id}
                      hasIssue={hasIssue}
                      issueData={issueData}
                      onIssueToggle={handleIssueToggle}
                    />
                  </div>
                </div>

                {/* Athlete Info */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{athlete.name}</h3>

                  <div className="space-y-1 text-sm text-slate-600">
                    {athlete.class_year && (
                      <p className="capitalize">{athlete.class_year}</p>
                    )}
                    {athlete.hometown && (
                      <p className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        {athlete.hometown}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Issue Button Component
function IssueButton({
  athleteId,
  hasIssue,
  issueData,
  onIssueToggle,
}: {
  athleteId: string;
  hasIssue: boolean;
  issueData?: DataQualityIssue;
  onIssueToggle: (athleteId: string, issues: string[], customNote?: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<string[]>(issueData?.issues || []);
  const [customNote, setCustomNote] = useState(issueData?.customNote || '');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const issueOptions = [
    'Female athlete',
    'Coach not needed',
    'Missing Headshot',
    'Missing position',
    'Missing URL link',
    'Wrong classification',
    'No height/weight',
    'No hometown',
    'Misc.',
  ];

  const handleIssueSelect = (issue: string) => {
    if (issue === 'Misc.') {
      setShowCustomInput(!showCustomInput);
    }

    setSelectedIssues(prev => {
      if (prev.includes(issue)) {
        return prev.filter(i => i !== issue);
      } else {
        return [...prev, issue];
      }
    });
  };

  const handleSave = () => {
    onIssueToggle(athleteId, selectedIssues, customNote);
    setShowMenu(false);
  };

  const handleClear = () => {
    setSelectedIssues([]);
    setCustomNote('');
    setShowCustomInput(false);
    onIssueToggle(athleteId, [], '');
    setShowMenu(false);
  };

  return (
    <>
      <motion.button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
          hasIssue
            ? 'bg-orange-500 text-white'
            : 'bg-black/30 text-white hover:bg-black/50'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Report data quality issue"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </motion.button>

      {showMenu && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Data Quality Issues</h3>
                <button
                  onClick={() => setShowMenu(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                {issueOptions.map(option => (
                  <label
                    key={option}
                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-3 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(option)}
                      onChange={() => handleIssueSelect(option)}
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-slate-300 rounded cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 checked:bg-blue-600 checked:border-blue-600 accent-blue-600"
                    />
                    <span className="text-base text-slate-700">{option}</span>
                  </label>
                ))}

                {showCustomInput && (
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full mt-3 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
