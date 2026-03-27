require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareData() {
  // Get all from both tables
  const { data: oldAthletes } = await supabase
    .from('swim_athletes')
    .select('name, team_id, headshot_url');
  
  const { data: newAthletes } = await supabase
    .from('athletes')
    .select('name, team_id, photo_url');
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, slug');
  
  console.log(`Old table (swim_athletes): ${oldAthletes.length}`);
  console.log(`New table (athletes): ${newAthletes.length}\n`);
  
  // Athletes with photos in each
  const oldWithPhotos = oldAthletes.filter(a => a.headshot_url);
  const newWithPhotos = newAthletes.filter(a => a.photo_url);
  
  console.log(`Old with photos: ${oldWithPhotos.length}`);
  console.log(`New with photos: ${newWithPhotos.length}\n`);
  
  // Find teams that exist in old but have no/few photos in new
  const teamPhotoComparison = {};
  
  oldWithPhotos.forEach(a => {
    if (!teamPhotoComparison[a.team_id]) {
      teamPhotoComparison[a.team_id] = { old: 0, new: 0 };
    }
    teamPhotoComparison[a.team_id].old++;
  });
  
  // Map new athletes by team
  const teamMap = {};
  teams.forEach(t => {
    if (t.slug) teamMap[t.slug] = t.id;
  });
  
  newWithPhotos.forEach(a => {
    // Find matching team slug
    const team = teams.find(t => t.id === a.team_id);
    if (team && team.slug) {
      if (!teamPhotoComparison[team.slug]) {
        teamPhotoComparison[team.slug] = { old: 0, new: 0 };
      }
      teamPhotoComparison[team.slug].new++;
    }
  });
  
  console.log('Teams with more photos in OLD table:');
  Object.entries(teamPhotoComparison)
    .filter(([slug, counts]) => counts.old > counts.new)
    .sort((a, b) => (b[1].old - b[1].new) - (a[1].old - a[1].new))
    .slice(0, 20)
    .forEach(([slug, counts]) => {
      const diff = counts.old - counts.new;
      console.log(`  ${slug}: ${counts.old} old, ${counts.new} new (${diff} missing)`);
    });
}

compareData();
