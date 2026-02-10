-- Create athletes table
CREATE TABLE IF NOT EXISTS athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  photo_url TEXT,
  athlete_type TEXT CHECK (athlete_type IN ('swimmer', 'diver')),
  class_year TEXT CHECK (class_year IN ('freshman', 'sophomore', 'junior', 'senior')),
  hometown TEXT,
  profile_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_athletes_team_id ON athletes(team_id);
CREATE INDEX idx_athletes_type ON athletes(athlete_type);
CREATE INDEX idx_athletes_class_year ON athletes(class_year);

-- Create updated_at trigger
CREATE TRIGGER athletes_updated_at
BEFORE UPDATE ON athletes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to update team athlete_count
CREATE OR REPLACE FUNCTION update_team_athlete_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE teams SET athlete_count = athlete_count + 1 WHERE id = NEW.team_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE teams SET athlete_count = athlete_count - 1 WHERE id = OLD.team_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.team_id != NEW.team_id THEN
    UPDATE teams SET athlete_count = athlete_count - 1 WHERE id = OLD.team_id;
    UPDATE teams SET athlete_count = athlete_count + 1 WHERE id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER athletes_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON athletes
FOR EACH ROW
EXECUTE FUNCTION update_team_athlete_count();
