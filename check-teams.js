const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    // Check target teams
    const teamNames = ['Georgia Tech', 'Alabama', 'Duke', 'TCU', 'Louisville', 'South Carolina', 'Arizona State', 'Penn State', 'Indiana', 'Purdue', 'Dartmouth', 'Ohio State', 'Florida State', 'NC State'];

    console.log('\nCurrent Database Status:');
    console.log('='.repeat(80));

    for (const name of teamNames) {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, name, athlete_count')
        .eq('name', name)
        .single();

      if (teamError) {
        console.log(`${name}: NOT FOUND`);
        continue;
      }

      const { data: athletes, error: athleteError } = await supabase
        .from('athletes')
        .select('id, name, photo_url')
        .eq('team_id', teamData.id);

      if (athleteError) {
        console.log(`${name}: ERROR - ${athleteError.message}`);
        continue;
      }

      const missingPhotos = athletes.filter(a => !a.photo_url).length;
      console.log(`${name.padEnd(20)} | ${String(athletes.length).padStart(3)} athletes | ${String(missingPhotos).padStart(2)} missing photos | DB count: ${teamData.athlete_count}`);
    }

    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

check();
