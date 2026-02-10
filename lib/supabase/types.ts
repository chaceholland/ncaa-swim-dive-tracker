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
  athlete_type: 'swimmer' | 'diver';
  class_year: 'freshman' | 'sophomore' | 'junior' | 'senior';
  hometown: string | null;
  profile_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Conference = 'SEC' | 'ACC' | 'Big Ten' | 'Big 12' | 'Ivy League' | 'Patriot League' | 'Other';
