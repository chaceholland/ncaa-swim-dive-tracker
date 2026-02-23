import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

// Generate or retrieve device ID for anonymous favorites
function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

export interface AthleteFavorite {
  id: string;
  name: string;
  team_id: string;
  athlete_type?: string;
  class_year?: string;
  photo_url?: string;
  hometown?: string;
}

export interface TeamFavorite {
  id: string;
  name: string;
  conference?: string;
  logo_url?: string;
}

export function useFavorites() {
  const [athleteFavorites, setAthleteFavorites] = useState<AthleteFavorite[]>([]);
  const [teamFavorites, setTeamFavorites] = useState<TeamFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId] = useState(() => getDeviceId());

  // Load favorites from Supabase
  const loadFavorites = useCallback(async () => {
    if (!deviceId) return;

    try {
      setLoading(true);

      // Load athlete favorites
      const { data: athleteData } = await supabase
        .from('csd_anon_favorites')
        .select('athlete_id, name, team_id, athlete_type, year_class, headshot, hometown')
        .eq('device_id', deviceId);

      if (athleteData) {
        setAthleteFavorites(
          athleteData.map((f) => ({
            id: f.athlete_id,
            name: f.name || '',
            team_id: f.team_id || '',
            athlete_type: f.athlete_type || undefined,
            class_year: f.year_class || undefined,
            photo_url: f.headshot || undefined,
            hometown: f.hometown || undefined,
          }))
        );
      }

      // Load team favorites
      const { data: teamData } = await supabase
        .from('csd_anon_team_favorites')
        .select('team_id, name, conference, logo')
        .eq('device_id', deviceId);

      if (teamData) {
        setTeamFavorites(
          teamData.map((f) => ({
            id: f.team_id,
            name: f.name || '',
            conference: f.conference || undefined,
            logo_url: f.logo || undefined,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Add athlete favorite
  const addAthleteFavorite = useCallback(
    async (athlete: AthleteFavorite) => {
      if (!deviceId) return;

      try {
        const { error } = await supabase.from('csd_anon_favorites').insert({
          device_id: deviceId,
          athlete_id: athlete.id,
          name: athlete.name,
          team_id: athlete.team_id,
          athlete_type: athlete.athlete_type,
          year_class: athlete.class_year,
          headshot: athlete.photo_url,
          hometown: athlete.hometown,
        });

        if (!error) {
          setAthleteFavorites((prev) => [...prev, athlete]);
        } else {
          console.error('Error adding athlete favorite:', error);
        }
      } catch (error) {
        console.error('Error adding athlete favorite:', error);
      }
    },
    [deviceId]
  );

  // Remove athlete favorite
  const removeAthleteFavorite = useCallback(
    async (athleteId: string) => {
      if (!deviceId) return;

      try {
        const { error } = await supabase
          .from('csd_anon_favorites')
          .delete()
          .eq('device_id', deviceId)
          .eq('athlete_id', athleteId);

        if (!error) {
          setAthleteFavorites((prev) => prev.filter((f) => f.id !== athleteId));
        } else {
          console.error('Error removing athlete favorite:', error);
        }
      } catch (error) {
        console.error('Error removing athlete favorite:', error);
      }
    },
    [deviceId]
  );

  // Toggle athlete favorite
  const toggleAthleteFavorite = useCallback(
    async (athlete: AthleteFavorite) => {
      const isFavorite = athleteFavorites.some((f) => f.id === athlete.id);
      if (isFavorite) {
        await removeAthleteFavorite(athlete.id);
      } else {
        await addAthleteFavorite(athlete);
      }
    },
    [athleteFavorites, addAthleteFavorite, removeAthleteFavorite]
  );

  // Add team favorite
  const addTeamFavorite = useCallback(
    async (team: TeamFavorite) => {
      if (!deviceId) return;

      try {
        const { error } = await supabase.from('csd_anon_team_favorites').insert({
          device_id: deviceId,
          team_id: team.id,
          name: team.name,
          conference: team.conference,
          logo: team.logo_url,
        });

        if (!error) {
          setTeamFavorites((prev) => [...prev, team]);
        } else {
          console.error('Error adding team favorite:', error);
        }
      } catch (error) {
        console.error('Error adding team favorite:', error);
      }
    },
    [deviceId]
  );

  // Remove team favorite
  const removeTeamFavorite = useCallback(
    async (teamId: string) => {
      if (!deviceId) return;

      try {
        const { error } = await supabase
          .from('csd_anon_team_favorites')
          .delete()
          .eq('device_id', deviceId)
          .eq('team_id', teamId);

        if (!error) {
          setTeamFavorites((prev) => prev.filter((f) => f.id !== teamId));
        } else {
          console.error('Error removing team favorite:', error);
        }
      } catch (error) {
        console.error('Error removing team favorite:', error);
      }
    },
    [deviceId]
  );

  // Toggle team favorite
  const toggleTeamFavorite = useCallback(
    async (team: TeamFavorite) => {
      const isFavorite = teamFavorites.some((f) => f.id === team.id);
      if (isFavorite) {
        await removeTeamFavorite(team.id);
      } else {
        await addTeamFavorite(team);
      }
    },
    [teamFavorites, addTeamFavorite, removeTeamFavorite]
  );

  // Check if athlete is favorite
  const isAthleteFavorite = useCallback(
    (athleteId: string) => {
      return athleteFavorites.some((f) => f.id === athleteId);
    },
    [athleteFavorites]
  );

  // Check if team is favorite
  const isTeamFavorite = useCallback(
    (teamId: string) => {
      return teamFavorites.some((f) => f.id === teamId);
    },
    [teamFavorites]
  );

  return {
    athleteFavorites,
    teamFavorites,
    loading,
    addAthleteFavorite,
    removeAthleteFavorite,
    toggleAthleteFavorite,
    addTeamFavorite,
    removeTeamFavorite,
    toggleTeamFavorite,
    isAthleteFavorite,
    isTeamFavorite,
    totalCount: athleteFavorites.length + teamFavorites.length,
  };
}
