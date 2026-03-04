"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMeetResults } from "@/lib/swimcloud";
import type { MeetDetailResult } from "@/lib/supabase/types";

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

function EventAccordion({
  eventName,
  results,
}: {
  eventName: string;
  results: MeetDetailResult["eventGroups"][number]["results"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{eventName}</span>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {results.length} result{results.length !== 1 ? "s" : ""}
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
        <div className="border-t border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-2.5 w-10">#</th>
                <th className="px-4 py-2.5">Athlete</th>
                <th className="px-4 py-2.5">Team</th>
                <th className="px-5 py-2.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-2.5 text-gray-400 font-mono text-xs">
                    {r.place ?? idx + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {r.athleteName}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 capitalize">
                    {r.teamId.replace(/-/g, " ")}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-blue-600">
                    {r.timeFormatted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MeetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MeetDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await getMeetResults(Number(id));
      if (!result) {
        setNotFound(true);
      } else {
        setData(result);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Skeleton header */}
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

  if (notFound || !data) {
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

  const { meet, eventGroups } = data;

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
                  <span className="flex items-center gap-1">
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {formatDate(meet.date_start)}
                    {meet.date_end && meet.date_end !== meet.date_start && (
                      <> &ndash; {formatDate(meet.date_end)}</>
                    )}
                  </span>
                )}
                {meet.location && (
                  <span className="flex items-center gap-1">
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
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {meet.location}
                  </span>
                )}
                {meet.url && (
                  <a
                    href={meet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
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
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    SwimCloud
                  </a>
                )}
              </div>
            </div>
            <CourseTypeBadge courseType={meet.course_type} />
          </div>

          <div className="mt-3 text-sm text-gray-400">
            {eventGroups.length} event{eventGroups.length !== 1 ? "s" : ""}
            {eventGroups.length > 0 && (
              <>
                {" "}
                &middot;{" "}
                {eventGroups.reduce((sum, g) => sum + g.results.length, 0)}{" "}
                results
              </>
            )}
          </div>
        </div>
      </div>

      {/* Event accordions */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {eventGroups.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No results available</p>
            <p className="text-gray-400 text-sm mt-2">
              Results for this meet have not been loaded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {eventGroups.map((group) => (
              <EventAccordion
                key={group.eventId}
                eventName={group.eventName}
                results={group.results}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
