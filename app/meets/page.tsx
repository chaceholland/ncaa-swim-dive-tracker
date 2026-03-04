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
        {meets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No meets found</p>
            <p className="text-gray-400 text-sm mt-2">
              Meets will appear here when data is available
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {meets.map((meet) => (
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
