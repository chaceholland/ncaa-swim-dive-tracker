'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Team, Athlete } from '@/lib/supabase/types';
import { getTeamGradient, getTeamInitials } from '@/lib/utils';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function TeamRosterPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);

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
            onClick={() => router.push('/')}
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
            onClick={() => router.push('/')}
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
        <h2 className="text-3xl font-bold text-slate-900 mb-8">Roster</h2>

        {athletes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 text-lg">No athletes found for this team.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {athletes.map((athlete, index) => (
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
                    />
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
