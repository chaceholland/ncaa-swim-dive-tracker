"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getMeetResults, getMeetResultsByTeam } from "@/lib/swimcloud";
import type {
  MeetDetailResult,
  MeetByTeamResult,
  MeetResultRow,
} from "@/lib/supabase/types";

type View = "event" | "team";
type SortKey = "place" | "athlete" | "team" | "time" | "score";
type SortDir = "asc" | "desc";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function CourseTypeBadge({ courseType }: { courseType: string }) {
  const colors: Record<string, string> = {
    SCY: "bg-blue-100 text-blue-700",
    SCM: "bg-purple-100 text-purple-700",
    LCM: "bg-green-100 text-green-700",
  };
  const cls = colors[courseType] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${cls}`}
    >
      {courseType}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg
        className="inline w-3 h-3 ml-1 text-gray-300"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <path d="M3 6l5-4 5 4H3zM3 10h10l-5 4-5-4z" />
      </svg>
    );
  }
  return (
    <svg
      className={`inline w-3 h-3 ml-1 text-gray-600 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
      fill="currentColor"
      viewBox="0 0 16 16"
    >
      <path d="M3 6l5-4 5 4H3z" />
    </svg>
  );
}

function sortRows(
  rows: MeetResultRow[],
  key: SortKey,
  dir: SortDir,
): MeetResultRow[] {
  const factor = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "place":
        cmp = (a.place ?? 999) - (b.place ?? 999);
        break;
      case "athlete":
        cmp = a.athleteName.localeCompare(b.athleteName);
        break;
      case "team":
        cmp = a.teamId.localeCompare(b.teamId);
        break;
      case "time":
        cmp = (a.timeMs || 0) - (b.timeMs || 0);
        break;
      case "score":
        cmp = (a.finalScore ?? 0) - (b.finalScore ?? 0);
        break;
    }
    return cmp * factor;
  });
  return copy;
}

function ResultsTable({
  results,
  eventType,
  sort,
  dir,
  onSort,
}: {
  results: MeetResultRow[];
  eventType: "swim" | "dive";
  sort: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const sorted = useMemo(
    () => sortRows(results, sort, dir),
    [results, sort, dir],
  );
  const valueLabel = eventType === "dive" ? "Score" : "Time";
  const valueKey: SortKey = eventType === "dive" ? "score" : "time";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide select-none">
          <th
            className="px-5 py-2.5 w-12 cursor-pointer hover:text-gray-700"
            onClick={() => onSort("place")}
          >
            # <SortIcon active={sort === "place"} dir={dir} />
          </th>
          <th
            className="px-4 py-2.5 cursor-pointer hover:text-gray-700"
            onClick={() => onSort("athlete")}
          >
            Athlete <SortIcon active={sort === "athlete"} dir={dir} />
          </th>
          <th
            className="px-4 py-2.5 cursor-pointer hover:text-gray-700"
            onClick={() => onSort("team")}
          >
            Team <SortIcon active={sort === "team"} dir={dir} />
          </th>
          <th
            className="px-5 py-2.5 text-right cursor-pointer hover:text-gray-700"
            onClick={() => onSort(valueKey)}
          >
            {valueLabel} <SortIcon active={sort === valueKey} dir={dir} />
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {sorted.map((r, idx) => (
          <tr
            key={`${r.athleteId}-${idx}`}
            className="hover:bg-gray-50 transition-colors"
          >
            <td className="px-5 py-2.5 text-gray-400 font-mono text-xs">
              {r.place ?? "—"}
            </td>
            <td className="px-4 py-2.5 font-medium text-gray-800">
              {r.athleteName}
            </td>
            <td className="px-4 py-2.5 text-gray-500 capitalize">
              {r.teamId.replace(/-/g, " ")}
            </td>
            <td className="px-5 py-2.5 text-right font-mono font-semibold text-blue-600">
              {eventType === "dive"
                ? r.finalScore?.toFixed(2) ?? "—"
                : r.timeFormatted || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventAccordion({
  eventId,
  eventName,
  eventType,
  results,
  openParam,
  onToggle,
  sort,
  dir,
  onSort,
}: {
  eventId: string;
  eventName: string;
  eventType: "swim" | "dive";
  results: MeetResultRow[];
  openParam: string;
  onToggle: () => void;
  sort: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const open = openParam === "all" || openParam.split(",").includes(eventId);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{eventName}</span>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
          {eventType === "dive" && (
            <span className="text-xs text-purple-700 bg-purple-100 rounded-full px-2 py-0.5">
              dive
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
      </button>

      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <ResultsTable
            results={results}
            eventType={eventType}
            sort={sort}
            dir={dir}
            onSort={onSort}
          />
        </div>
      )}
    </div>
  );
}

export default function MeetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") as View) || "event";
  const openParam = searchParams.get("open") || "";
  const sort = (searchParams.get("sort") as SortKey) || "place";
  const dir = (searchParams.get("dir") as SortDir) || "asc";

  const [eventData, setEventData] = useState<MeetDetailResult | null>(null);
  const [teamData, setTeamData] = useState<MeetByTeamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [e, t] = await Promise.all([
        getMeetResults(Number(id)),
        getMeetResultsByTeam(Number(id)),
      ]);
      if (!e || !t) {
        setNotFound(true);
      } else {
        setEventData(e);
        setTeamData(t);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  function updateParam(key: string, value: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") sp.delete(key);
    else sp.set(key, value);
    router.replace(`/meets/${id}?${sp.toString()}`);
  }

  function toggleEventOpen(eventId: string) {
    if (openParam === "all") {
      const allIds = eventData?.eventGroups.map((g) => g.eventId) ?? [];
      const remaining = allIds.filter((e) => e !== eventId);
      updateParam("open", remaining.join(","));
      return;
    }
    const open = new Set(openParam ? openParam.split(",") : []);
    if (open.has(eventId)) open.delete(eventId);
    else open.add(eventId);
    updateParam("open", Array.from(open).join(","));
  }

  function toggleSort(key: SortKey) {
    if (sort === key) {
      updateParam("dir", dir === "asc" ? "desc" : "asc");
    } else {
      updateParam("sort", key);
      updateParam("dir", "asc");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-3">
            <div className="h-8 w-80 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 bg-white rounded-xl border border-gray-200 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !eventData || !teamData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-xl font-semibold">Meet not found</p>
          <p className="text-gray-400 text-sm mt-2">
            This meet may not exist or has no data yet.
          </p>
          <Link
            href="/meets"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
          >
            &larr; Back to Meets
          </Link>
        </div>
      </div>
    );
  }

  const meet = eventData.meet;
  const totalResults = eventData.eventGroups.reduce(
    (s, g) => s + g.results.length,
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link
            href="/meets"
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            All Meets
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {meet.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {meet.date_start && (
                  <span>
                    {formatDate(meet.date_start)}
                    {meet.date_end && meet.date_end !== meet.date_start && (
                      <> &ndash; {formatDate(meet.date_end)}</>
                    )}
                  </span>
                )}
                {meet.location && <span>{meet.location}</span>}
                {meet.url && (
                  <a
                    href={meet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    SwimCloud ↗
                  </a>
                )}
              </div>
            </div>
            <CourseTypeBadge courseType={meet.course_type} />
          </div>

          <div className="mt-3 text-sm text-gray-400">
            {eventData.eventGroups.length} event
            {eventData.eventGroups.length !== 1 ? "s" : ""} &middot;{" "}
            {totalResults} results &middot; {teamData.teamGroups.length} teams
          </div>

          {/* Controls */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 text-sm">
              <button
                onClick={() => updateParam("view", "event")}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  view === "event"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                By Event
              </button>
              <button
                onClick={() => updateParam("view", "team")}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  view === "team"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                By Team
              </button>
            </div>

            {view === "event" && (
              <>
                <button
                  onClick={() => updateParam("open", "all")}
                  className="text-sm px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Expand all
                </button>
                <button
                  onClick={() => updateParam("open", null)}
                  className="text-sm px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Collapse all
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {totalResults === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No results available</p>
            <p className="text-gray-400 text-sm mt-2">
              Results for this meet have not been loaded yet.
            </p>
          </div>
        ) : view === "team" ? (
          <div className="space-y-2">
            {teamData.teamGroups.map((group) => {
              const teamKey = `team:${group.teamId}`;
              const open =
                openParam === "all" ||
                openParam.split(",").includes(teamKey);
              return (
                <div
                  key={group.teamId}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => {
                      const set = new Set(
                        openParam ? openParam.split(",") : [],
                      );
                      if (openParam === "all") {
                        const allKeys = teamData.teamGroups.map(
                          (g) => `team:${g.teamId}`,
                        );
                        updateParam(
                          "open",
                          allKeys.filter((k) => k !== teamKey).join(","),
                        );
                        return;
                      }
                      if (set.has(teamKey)) set.delete(teamKey);
                      else set.add(teamKey);
                      updateParam("open", Array.from(set).join(","));
                    }}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 capitalize">
                        {group.teamName}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                        {group.athleteCount} athlete
                        {group.athleteCount !== 1 ? "s" : ""} &middot;{" "}
                        {group.rows.length} swim
                        {group.rows.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <th className="px-5 py-2.5 w-32">Event</th>
                            <th className="px-4 py-2.5 w-10 text-right">#</th>
                            <th className="px-4 py-2.5">Athlete</th>
                            <th className="px-5 py-2.5 text-right">
                              Time / Score
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {group.rows.map((r, idx) => (
                            <tr
                              key={`${r.eventId}-${r.athleteId}-${idx}`}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-5 py-2.5 text-gray-600 text-xs">
                                {r.eventName}
                              </td>
                              <td className="px-4 py-2.5 text-gray-400 font-mono text-xs text-right">
                                {r.place ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 font-medium text-gray-800">
                                {r.athleteName}
                              </td>
                              <td className="px-5 py-2.5 text-right font-mono font-semibold text-blue-600">
                                {r.eventType === "dive"
                                  ? r.finalScore?.toFixed(2) ?? "—"
                                  : r.timeFormatted || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {eventData.eventGroups.map((group) => (
              <EventAccordion
                key={group.eventId}
                eventId={group.eventId}
                eventName={group.eventName}
                eventType={group.eventType}
                results={group.results}
                openParam={openParam}
                onToggle={() => toggleEventOpen(group.eventId)}
                sort={sort}
                dir={dir}
                onSort={toggleSort}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
