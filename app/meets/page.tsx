import Link from "next/link";
import { getAllMeets } from "@/lib/swimcloud";
import type { SwimMeet } from "@/lib/supabase/types";

export const revalidate = 3600;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      {courseType}
    </span>
  );
}

export default async function MeetsPage() {
  const meets: SwimMeet[] = await getAllMeets({ limit: 100 });
  // D1 (swim analog of the "Today" strip): feature the most-recent meet.
  // getAllMeets returns date_start DESC, so meets[0] is the latest.
  const latest = meets[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-1">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900">Meets</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {meets.length} meet{meets.length !== 1 ? "s" : ""} tracked &mdash;
            2024-25 season
          </p>
        </div>
      </div>

      {/* Meet list */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Latest meet highlight (D1) */}
        {latest && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Latest meet
            </h2>
            <Link
              href={`/meets/${latest.id}`}
              className="block bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl px-6 py-5 text-white shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 flex-shrink-0 text-center">
                  {latest.date_start ? (
                    <>
                      <div className="text-xs text-blue-100 uppercase tracking-wide">
                        {new Date(latest.date_start).toLocaleDateString("en-US", {
                          month: "short",
                        })}
                      </div>
                      <div className="text-3xl font-bold leading-none">
                        {new Date(latest.date_start).getDate()}
                      </div>
                      <div className="text-xs text-blue-100">
                        {new Date(latest.date_start).getFullYear()}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-blue-100 font-medium">TBD</div>
                  )}
                </div>
                <div className="w-px h-14 bg-white/30 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{latest.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-blue-100 text-sm">
                    {latest.location && (
                      <span className="truncate">{latest.location}</span>
                    )}
                    {latest.date_end && latest.date_end !== latest.date_start && (
                      <>
                        {latest.location && (
                          <span className="text-blue-200">·</span>
                        )}
                        <span>Ends {formatDate(latest.date_end)}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white flex-shrink-0">
                  {latest.course_type}
                </span>
                <svg
                  className="w-5 h-5 text-white/80 group-hover:translate-x-0.5 transition-transform flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          </div>
        )}

        {meets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No meets found</p>
            <p className="text-gray-400 text-sm mt-2">
              Meets will appear here when data is available
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {meets.slice(1).map((meet) => (
              <Link
                key={meet.id}
                href={`/meets/${meet.id}`}
                className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                {/* Date column */}
                <div className="w-24 flex-shrink-0 text-center">
                  {meet.date_start ? (
                    <>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">
                        {new Date(meet.date_start).toLocaleDateString("en-US", {
                          month: "short",
                        })}
                      </div>
                      <div className="text-2xl font-bold text-gray-800 leading-none">
                        {new Date(meet.date_start).getDate()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(meet.date_start).getFullYear()}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-300 font-medium">TBD</div>
                  )}
                </div>

                {/* Divider */}
                <div className="w-px h-12 bg-gray-200 flex-shrink-0" />

                {/* Meet info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                    {meet.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {meet.location && (
                      <span className="text-xs text-gray-500 truncate">
                        {meet.location}
                      </span>
                    )}
                    {meet.date_end && meet.date_end !== meet.date_start && (
                      <>
                        {meet.location && (
                          <span className="text-gray-300">·</span>
                        )}
                        <span className="text-xs text-gray-400">
                          Ends {formatDate(meet.date_end)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right side badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CourseTypeBadge courseType={meet.course_type} />
                  <svg
                    className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
