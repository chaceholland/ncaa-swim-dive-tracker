require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const SQL_COMMANDS = `
-- Create athlete favorites table
CREATE TABLE IF NOT EXISTS csd_anon_favorites (
  id SERIAL PRIMARY KEY,
  device_id UUID NOT NULL,
  athlete_id TEXT NOT NULL,
  name TEXT,
  team_id TEXT,
  year_class TEXT,
  headshot TEXT,
  athlete_type TEXT DEFAULT 'swimmer',
  hometown TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_csd_anon_fav_device ON csd_anon_favorites(device_id);
CREATE INDEX IF NOT EXISTS idx_csd_anon_fav_athlete ON csd_anon_favorites(athlete_id);

-- Create team favorites table
CREATE TABLE IF NOT EXISTS csd_anon_team_favorites (
  id SERIAL PRIMARY KEY,
  device_id UUID NOT NULL,
  team_id TEXT NOT NULL,
  name TEXT,
  conference TEXT,
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_csd_anon_team_fav_device ON csd_anon_team_favorites(device_id);
CREATE INDEX IF NOT EXISTS idx_csd_anon_team_fav_team ON csd_anon_team_favorites(team_id);

-- Disable RLS (public access for anonymous favorites)
ALTER TABLE csd_anon_favorites DISABLE ROW LEVEL SECURITY;
ALTER TABLE csd_anon_team_favorites DISABLE ROW LEVEL SECURITY;
`;

async function main() {
  console.log('Creating favorites tables...\n');

  // Execute via RPC or direct SQL
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ sql: SQL_COMMANDS }),
      }
    );

    if (response.ok) {
      console.log('✅ Favorites tables created successfully!');
    } else {
      const error = await response.text();
      console.log('⚠️  Could not create via RPC:', error);
      console.log('\nPlease run this SQL manually in Supabase dashboard:');
      console.log('https://supabase.com/dashboard/project/dtnozcqkuzhjmjvsfjqk/sql/new\n');
      console.log(SQL_COMMANDS);
    }
  } catch (error) {
    console.log('⚠️  Could not create via API');
    console.log('\nPlease run this SQL manually in Supabase dashboard:');
    console.log('https://supabase.com/dashboard/project/dtnozcqkuzhjmjvsfjqk/sql/new\n');
    console.log(SQL_COMMANDS);
  }
}

main().catch(console.error);
