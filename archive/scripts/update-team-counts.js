require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCounts() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name');

  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id')
      .eq('team_id', team.id);

    await supabase
      .from('teams')
      .update({ athlete_count: athletes.length })
      .eq('id', team.id);
  }

  // Show updated photo stats
  const { data: allAthletes } = await supabase
    .from('athletes')
    .select('photo_url');

  const withPhotos = allAthletes.filter(a => a.photo_url).length;
  const total = allAthletes.length;
  const coverage = ((withPhotos / total) * 100).toFixed(1);

  console.log('='.repeat(60));
  console.log('UPDATED DATABASE STATS');
  console.log('='.repeat(60));
  console.log(`Total athletes: ${total}`);
  console.log(`With photos: ${withPhotos}`);
  console.log(`Without photos: ${total - withPhotos}`);
  console.log(`Coverage: ${coverage}%`);
  console.log('='.repeat(60));
}

updateCounts();
