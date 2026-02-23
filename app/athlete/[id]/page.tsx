'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import type { Athlete, Team } from '@/lib/supabase/types';
import { useFavorites } from '@/lib/hooks/useFavorites';
import Button from '@/components/ui/Button';
import AthleteCard from '@/components/AthleteCard';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function AthletePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teammates, setTeammates] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoError, setPhotoError] = useState(false);

  // Use favorites hook
  const { toggleAthleteFavorite, isAthleteFavorite } = useFavorites();

  useEffect(() => {
    async function load() {
      const { data: athleteData } = await supabase
        .from('athletes')
        .select('*')
        .eq('id', id)
        .single();

      if (!athleteData) { router.push('/'); return; }
      setAthlete(athleteData);

      const [{ data: teamData }, { data: teammatesData }] = await Promise.all([
        supabase.from('teams').select('*').eq('id', athleteData.team_id).single(),
        supabase.from('athletes').select('*')
          .eq('team_id', athleteData.team_id)
          .neq('id', id)
          .order('name')
          .limit(8),
      ]);

      setTeam(teamData);
      setTeammates(teammatesData || []);
      setLoading(false);
    }
    load();
  }, [id, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-72 bg-gray-200 animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!athlete || !team) return null;

  const primary = team.primary_color || '#1e40af';
  const secondary = team.secondary_color || '#1e3a8a';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Gradient header */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 60%),
              radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 py-12 flex gap-10 items-center">
          <button
            onClick={() => router.back()}
            className="absolute top-6 left-6 text-white/70 hover:text-white flex items-center gap-1 text-sm transition-colors"
          >
            ← Back
          </button>

          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 mt-6"
          >
            <div className="w-48 h-56 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-white/10">
              {athlete.photo_url && !photoError ? (
                <Image
                  src={athlete.photo_url}
                  alt={athlete.name}
                  width={192}
                  height={224}
                  className="w-full h-full object-cover object-top"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60 text-4xl font-bold">
                  {getInitials(athlete.name)}
                </div>
              )}
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 text-white mt-6"
          >
            <div className="flex items-center gap-3 mb-2">
              {team.logo_url && (
                <Image src={team.logo_url} alt={team.name} width={28} height={28}
                  className="w-7 h-7 object-contain" />
              )}
              <Link href={`/team/${team.id}`}
                className="text-white/80 hover:text-white text-sm font-medium transition-colors">
                {team.name}
              </Link>
              {team.conference_display_name && (
                <>
                  <span className="text-white/40">·</span>
                  <span className="text-white/60 text-sm">{team.conference_display_name}</span>
                </>
              )}
            </div>

            <h1 className="text-4xl font-bold mb-4">{athlete.name}</h1>

            <div className="flex flex-wrap gap-2 mb-6">
              {athlete.athlete_type && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {athlete.athlete_type.charAt(0).toUpperCase() + athlete.athlete_type.slice(1)}
                </span>
              )}
              {athlete.class_year && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {athlete.class_year.charAt(0).toUpperCase() + athlete.class_year.slice(1)}
                </span>
              )}
              {athlete.hometown && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  📍 {athlete.hometown}
                </span>
              )}
            </div>

            {athlete.profile_url && (
              <a href={athlete.profile_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="md">
                  Official Profile →
                </Button>
              </a>
            )}
          </motion.div>
        </div>
      </div>

      {/* Teammates grid */}
      {teammates.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            More from {team.name}
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {teammates.map((tm, index) => (
              <AthleteCard
                key={tm.id}
                athlete={tm}
                team={team}
                index={index}
                isFavorite={isAthleteFavorite(tm.id)}
                onFavoriteToggle={() => toggleAthleteFavorite({
                  id: tm.id,
                  name: tm.name,
                  team_id: tm.team_id,
                  athlete_type: tm.athlete_type || undefined,
                  class_year: tm.class_year || undefined,
                  photo_url: tm.photo_url || undefined,
                  hometown: tm.hometown || undefined
                })}
              />
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href={`/team/${team.id}`}>
              <Button variant="outline" size="md">View Full Roster</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
