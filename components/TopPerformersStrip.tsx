"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatSwimTime, formatEventName } from "@/lib/swimcloud";
import { isExternalUrl } from "@/lib/image-utils";

// Featured events with hyphenated IDs matching the DB
const FEATURED_EVENTS = [
  "50-free",
  "100-free",
  "200-free",
  "500-free",
  "1000-free",
  "1650-free",
  "100-back",
  "200-back",
  "100-breast",
  "200-breast",
  "100-fly",
  "200-fly",
  "200-im",
  "400-im",
  "1m-diving",
  "3m-diving",
];

interface Performer {
  rank: number;
  athleteId: string; // swimcloud_id
  name: string;
  teamId: string; // slug like "ohio-state"
  teamName: string;
  timeMs: number;
  timeFormatted: string;
  photoUrl: string | null;
  profileId: string | null; // UUID from web app athletes table
}

export default function TopPerformersStrip() {
  const [selectedEvent, setSelectedEvent] = useState("100-free");
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    async function fetchTopPerformers() {
      setLoading(true);
      setPerformers([]);
      setHasData(true);

      try {
        const supabase = createClient();

        // 1. Fetch all results for this event, ordered by time ascending
        const { data: results, error } = await supabase
          .from("swim_individual_results")
          .select("athlete_id, final_time_ms")
          .eq("event_id", selectedEvent)
          .not("final_time_ms", "is", null)
          .order("final_time_ms", { ascending: true });

        if (error || !results || results.length === 0) {
          setHasData(false);
          setLoading(false);
          return;
        }

        // 2. Deduplicate to best time per athlete
        const bestByAthlete = new Map<string, number>();
        for (const row of results) {
          const existing = bestByAthlete.get(row.athlete_id);
          if (existing === undefined || row.final_time_ms < existing) {
            bestByAthlete.set(row.athlete_id, row.final_time_ms);
          }
        }

        // Sort and take top 10
        const top10 = Array.from(bestByAthlete.entries())
          .sort(([, a], [, b]) => a - b)
          .slice(0, 10);

        if (top10.length === 0) {
          setHasData(false);
          setLoading(false);
          return;
        }

        const athleteIds = top10.map(([id]) => id);

        // 3. Look up athlete info from swim_athletes
        const { data: swimAthletes } = await supabase
          .from("swim_athletes")
          .select("swimcloud_id, name, team_id")
          .in("swimcloud_id", athleteIds);

        const swimAthleteMap = new Map<
          string,
          { name: string; teamId: string }
        >();
        for (const a of swimAthletes ?? []) {
          if (a.swimcloud_id) {
            swimAthleteMap.set(a.swimcloud_id, {
              name: a.name,
              teamId: a.team_id,
            });
          }
        }

        // 4. Convert team_id slug to display name (e.g. "ohio-state" → "Ohio State")
        function slugToDisplayName(slug: string): string {
          return slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }

        // 5. Try to match to web app athletes table for photos and profile IDs
        // Match by name — best-effort
        const athleteNames = (swimAthletes ?? [])
          .map((a) => a.name)
          .filter(Boolean);
        const { data: webAthletes } = await supabase
          .from("athletes")
          .select("id, name, photo_url, team_id")
          .eq("is_archived", false)
          .in("name", athleteNames);

        // Build a name -> web athlete lookup (take first match)
        const webAthleteByName = new Map<
          string,
          { photoUrl: string | null; id: string }
        >();
        for (const wa of webAthletes ?? []) {
          if (!webAthleteByName.has(wa.name)) {
            webAthleteByName.set(wa.name, {
              photoUrl: wa.photo_url ?? null,
              id: wa.id,
            });
          }
        }

        // 6. Build performer list
        const performerList: Performer[] = top10.map(
          ([athleteId, timeMs], idx) => {
            const swimAthlete = swimAthleteMap.get(athleteId);
            const name = swimAthlete?.name ?? `Athlete #${athleteId}`;
            const teamId = swimAthlete?.teamId ?? "";
            const teamName = teamId ? slugToDisplayName(teamId) : "";
            const webAthlete = webAthleteByName.get(name);

            return {
              rank: idx + 1,
              athleteId,
              name,
              teamId,
              teamName,
              timeMs,
              timeFormatted: formatSwimTime(timeMs),
              photoUrl: webAthlete?.photoUrl ?? null,
              profileId: webAthlete?.id ?? null,
            };
          },
        );

        setPerformers(performerList);
        setHasData(performerList.length > 0);
      } catch (err) {
        console.error("Error fetching top performers:", err);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    }

    fetchTopPerformers();
  }, [selectedEvent]);

  return (
    <section className="w-full bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] py-10 px-4 sm:px-6">
      <div className="max-w-screen-2xl mx-auto">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Top Performers</h2>
            <p className="text-white/60 text-sm mt-1">
              Best times across all tracked teams
            </p>
          </div>

          {/* Event picker */}
          <div className="relative">
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2.5 pr-10 text-sm font-medium cursor-pointer hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-cyan"
            >
              {FEATURED_EVENTS.map((eventId) => (
                <option
                  key={eventId}
                  value={eventId}
                  className="bg-[#0A1628] text-white"
                >
                  {formatEventName(eventId)}
                </option>
              ))}
            </select>
            {/* Chevron icon */}
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg
                className="w-4 h-4 text-white/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          // Loading skeleton
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-44 bg-white/10 rounded-2xl p-4 animate-pulse"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full mb-3" />
                <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-3" />
                <div className="h-4 bg-white/20 rounded w-3/4 mx-auto mb-2" />
                <div className="h-3 bg-white/20 rounded w-1/2 mx-auto mb-2" />
                <div className="h-5 bg-white/20 rounded w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        ) : !hasData ? (
          // Empty state
          <div className="flex items-center justify-center py-12 px-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-white/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <p className="text-white/60 text-sm">
                No results tracked for this event yet.
              </p>
            </div>
          </div>
        ) : (
          // Horizontal scroll strip
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {performers.map((p) => (
              <PerformerCard key={p.athleteId} performer={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PerformerCard({ performer }: { performer: Performer }) {
  const { rank, name, teamName, timeFormatted, photoUrl, profileId } =
    performer;

  const isGold = rank === 1;
  const isSilver = rank === 2;
  const isBronze = rank === 3;

  const rankBgClass = isGold
    ? "bg-yellow-400 text-yellow-900"
    : isSilver
      ? "bg-slate-300 text-slate-700"
      : isBronze
        ? "bg-amber-600 text-amber-100"
        : "bg-white/20 text-white";

  const cardContent = (
    <div
      className={`
        flex-shrink-0 w-44 rounded-2xl p-4 flex flex-col items-center
        border transition-all duration-200 hover:scale-105
        ${
          isGold
            ? "bg-yellow-400/10 border-yellow-400/40 hover:bg-yellow-400/20"
            : "bg-white/10 border-white/20 hover:bg-white/15"
        }
      `}
    >
      {/* Rank badge */}
      <div
        className={`self-start text-xs font-bold px-2 py-1 rounded-full mb-3 ${rankBgClass}`}
      >
        #{rank}
      </div>

      {/* Photo */}
      <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 mb-3 flex-shrink-0 border-2 border-white/20">
        {photoUrl && isExternalUrl(photoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white/60">
            {name.charAt(0)}
          </div>
        )}
      </div>

      {/* Name */}
      <p className="text-white text-sm font-semibold text-center leading-tight mb-1 line-clamp-2">
        {name}
      </p>

      {/* Team */}
      <p className="text-white/50 text-xs text-center mb-3 line-clamp-1">
        {teamName}
      </p>

      {/* Time */}
      <div
        className={`
          text-lg font-bold font-mono
          ${isGold ? "text-yellow-300" : "text-brand-cyan"}
        `}
      >
        {timeFormatted}
      </div>
    </div>
  );

  // If we have a profile ID, wrap in a link
  if (profileId) {
    return (
      <a href={`/athlete/${profileId}`} className="block">
        {cardContent}
      </a>
    );
  }

  return cardContent;
}
