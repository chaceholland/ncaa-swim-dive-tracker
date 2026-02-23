'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { Athlete, Team } from '@/lib/supabase/types';
import Badge from '@/components/ui/Badge';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get('q') || '';
  const supabase = createClient();

  const [query, setQuery] = useState(q);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(q);
    if (!q.trim()) return;
    setLoading(true);
    const pattern = `%${q.trim()}%`;
    Promise.all([
      supabase.from('athletes').select('*').ilike('name', pattern).limit(50),
      supabase.from('teams').select('*').ilike('name', pattern).limit(20),
    ]).then(async ([{ data: athleteData }, { data: teamData }]) => {
      setAthletes(athleteData || []);
      setTeams(teamData || []);
      const teamIds = [...new Set((athleteData || []).map(a => a.team_id))];
      if (teamIds.length > 0) {
        const { data: relatedTeams } = await supabase
          .from('teams').select('*').in('id', teamIds);
        const map: Record<string, Team> = {};
        (relatedTeams || []).forEach(t => { map[t.id] = t; });
        setTeamMap(map);
      }
      setLoading(false);
    });
  }, [q]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search bar header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search athletes or teams..."
              autoFocus
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>
          {!loading && q && (
            <p className="mt-3 text-sm text-gray-500">
              {athletes.length + teams.length} result{athletes.length + teams.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">
        {/* Athletes — left, dominant */}
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Athletes {!loading && `(${athletes.length})`}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : athletes.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No athletes found.</p>
          ) : (
            <div className="space-y-2">
              {athletes.map((a, i) => {
                const t = teamMap[a.team_id];
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                  >
                    <Link
                      href={`/athlete/${a.id}`}
                      className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                    >
                      <div className="w-12 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {a.photo_url && !a.photo_url.startsWith('/logos/') ? (
                          <Image src={a.photo_url} alt={a.name} width={48} height={56}
                            className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                            {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors truncate">
                          {a.name}
                        </div>
                        <div className="text-sm text-gray-400 truncate">
                          {t?.name}
                          {a.class_year && ` · ${a.class_year.charAt(0).toUpperCase() + a.class_year.slice(1)}`}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {a.athlete_type && (
                          <Badge variant={a.athlete_type as 'swimmer' | 'diver'}>
                            {a.athlete_type}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Teams — right sidebar */}
        <div className="w-64 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Teams {!loading && `(${teams.length})`}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <p className="text-gray-400 text-sm">No teams found.</p>
          ) : (
            <div className="space-y-2">
              {teams.map(t => (
                <Link
                  key={t.id}
                  href={`/team/${t.id}`}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                >
                  {t.logo_url && (
                    <Image src={t.logo_url} alt={t.name} width={36} height={36}
                      className="w-9 h-9 object-contain flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-800 group-hover:text-blue-700 transition-colors truncate">
                      {t.name}
                    </div>
                    <div className="text-xs text-gray-400">{t.conference_display_name}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <SearchResults />
    </Suspense>
  );
}
