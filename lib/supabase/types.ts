export interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  logo_fallback_url: string | null;
  primary_color: string;
  secondary_color: string;
  conference: string;
  conference_display_name: string;
  athlete_count: number;
  created_at: string;
  updated_at: string;
}

export interface Athlete {
  id: string;
  name: string;
  team_id: string;
  photo_url: string | null;
  athlete_type: "swimmer" | "diver";
  class_year: "freshman" | "sophomore" | "junior" | "senior";
  hometown: string | null;
  profile_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type Conference =
  | "SEC"
  | "ACC"
  | "Big Ten"
  | "Big 12"
  | "Ivy League"
  | "Patriot League"
  | "Other";

export interface SwimMeet {
  id: number;
  name: string;
  url: string | null;
  season: string;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  course_type: string;
}

export interface AthleteBestTime {
  eventId: string;
  eventName: string;
  timeMs: number;
  timeFormatted: string;
  place: number | null;
  meetName: string;
  meetDate: string | null;
  meetId: number;
}

export interface RecentMeet {
  id: number;
  name: string;
  date_start: string | null;
  location: string | null;
  events: string[];
  times: string[];
}

export interface MeetDetailResult {
  meet: SwimMeet;
  eventGroups: {
    eventId: string;
    eventName: string;
    results: {
      place: number | null;
      athleteName: string;
      teamId: string;
      timeMs: number;
      timeFormatted: string;
    }[];
  }[];
}
