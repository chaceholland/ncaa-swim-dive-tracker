"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import type {
  Athlete,
  Team,
  AthleteBestTime,
  RecentMeet,
} from "@/lib/supabase/types";
import { isExternalUrl } from "@/lib/image-utils";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { getAthleteBestTimes, getAthleteRecentMeets } from "@/lib/swimcloud";
import Button from "@/components/ui/Button";
import AthleteCard from "@/components/AthleteCard";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AthletePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teammates, setTeammates] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoError, setPhotoError] = useState(false);

  const [bestTimes, setBestTimes] = useState<AthleteBestTime[]>([]);
  const [recentMeets, setRecentMeets] = useState<RecentMeet[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Use favorites hook
  const { toggleAthleteFavorite, isAthleteFavorite } = useFavorites();

  useEffect(() => {
    async function load() {
      const { data: athleteData } = await supabase
        .from("athletes")
        .select("*")
        .eq("id", id)
        .single();

      if (!athleteData) {
        router.push("/");
        return;
      }
      setAthlete(athleteData);

      const [{ data: teamData }, { data: teammatesData }] = await Promise.all([
        supabase
          .from("teams")
          .select("*")
          .eq("id", athleteData.team_id)
          .single(),
        supabase
          .from("athletes")
          .select("*")
          .eq("team_id", athleteData.team_id)
          .neq("id", id)
          .order("name")
          .limit(8),
      ]);

      setTeam(teamData);
      setTeammates(teammatesData || []);
      setLoading(false);

      if (teamData && athleteData) {
        setResultsLoading(true);
        const [times, meets] = await Promise.all([
          getAthleteBestTimes(athleteData.name, teamData.name),
          getAthleteRecentMeets(athleteData.name, teamData.name),
        ]);
        setBestTimes(times);
        setRecentMeets(meets);
        setResultsLoading(false);
      }
    }
    load();
  }, [id, router]);

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

  const primary = team.primary_color || "#1e40af";
  const secondary = team.secondary_color || "#1e3a8a";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Gradient header */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        }}
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
            &larr; Back
          </button>

          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 mt-6"
          >
            <div className="w-48 h-56 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-white/10">
              {athlete.photo_url && !photoError ? (
                isExternalUrl(athlete.photo_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={athlete.photo_url}
                    alt={athlete.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <Image
                    src={athlete.photo_url}
                    alt={athlete.name}
                    width={192}
                    height={224}
                    className="w-full h-full object-cover object-top"
                    onError={() => setPhotoError(true)}
                  />
                )
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
              {team.logo_url &&
                (isExternalUrl(team.logo_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logo_url}
                    alt={team.name}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 object-contain"
                  />
                ) : (
                  <Image
                    src={team.logo_url}
                    alt={team.name}
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain"
                  />
                ))}
              <Link
                href={`/team/${team.id}`}
                className="text-white/80 hover:text-white text-sm font-medium transition-colors"
              >
                {team.name}
              </Link>
              {team.conference_display_name && (
                <>
                  <span className="text-white/40">&middot;</span>
                  <span className="text-white/60 text-sm">
                    {team.conference_display_name}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-4xl font-bold mb-4">{athlete.name}</h1>

            <div className="flex flex-wrap gap-2 mb-6">
              {athlete.athlete_type && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {athlete.athlete_type.charAt(0).toUpperCase() +
                    athlete.athlete_type.slice(1)}
                </span>
              )}
              {athlete.class_year && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {athlete.class_year.charAt(0).toUpperCase() +
                    athlete.class_year.slice(1)}
                </span>
              )}
              {athlete.hometown && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {athlete.hometown}
                </span>
              )}
            </div>

            {athlete.profile_url && (
              <a
                href={athlete.profile_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="md">
                  Official Profile &rarr;
                </Button>
              </a>
            )}
          </motion.div>
        </div>
      </div>

      {/* Best Times + Recent Meets */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best Times Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Season Best Times
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Best performance per event (2024-25)
              </p>
            </div>
            {resultsLoading ? (
              <div className="px-6 py-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-28" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
                  </div>
                ))}
              </div>
            ) : bestTimes.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-400 text-sm">No tracked times yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Results appear when swim data is available
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3">Event</th>
                      <th className="px-4 py-3 text-right">Time</th>
                      <th className="px-6 py-3 text-right">Meet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bestTimes.map((bt) => (
                      <tr
                        key={bt.eventId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-3 font-medium text-gray-800">
                          {bt.eventName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/meets/${bt.meetId}`}
                            className="font-mono font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {bt.timeFormatted}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Link
                            href={`/meets/${bt.meetId}`}
                            className="text-gray-500 hover:text-gray-700 text-xs truncate max-w-[140px] block text-right transition-colors"
                          >
                            {bt.meetName}
                          </Link>
                          {bt.meetDate && (
                            <span className="text-gray-400 text-xs block text-right">
                              {formatDate(bt.meetDate)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Meets Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Recent Meets</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Latest competition appearances
              </p>
            </div>
            {resultsLoading ? (
              <div className="px-6 py-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-5 bg-gray-200 rounded animate-pulse w-48" />
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-32" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-20" />
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentMeets.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-400 text-sm">No tracked meets yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Appearances will show here when available
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentMeets.map((meet) => (
                  <li
                    key={meet.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <Link href={`/meets/${meet.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate hover:text-blue-700 transition-colors">
                            {meet.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {meet.date_start && (
                              <span className="text-xs text-gray-400">
                                {formatDate(meet.date_start)}
                              </span>
                            )}
                            {meet.location && (
                              <>
                                {meet.date_start && (
                                  <span className="text-gray-300">·</span>
                                )}
                                <span className="text-xs text-gray-400 truncate">
                                  {meet.location}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {meet.events.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {meet.events.slice(0, 4).map((evt, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                            >
                              {evt}
                              <span className="font-mono text-blue-500">
                                {meet.times[idx]}
                              </span>
                            </span>
                          ))}
                          {meet.events.length > 4 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                              +{meet.events.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Teammates grid */}
        {teammates.length > 0 && (
          <div>
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
                  onFavoriteToggle={() =>
                    toggleAthleteFavorite({
                      id: tm.id,
                      name: tm.name,
                      team_id: tm.team_id,
                      athlete_type: tm.athlete_type || undefined,
                      class_year: tm.class_year || undefined,
                      photo_url: tm.photo_url || undefined,
                      hometown: tm.hometown || undefined,
                    })
                  }
                />
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link href={`/team/${team.id}`}>
                <Button variant="outline" size="md">
                  View Full Roster
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
