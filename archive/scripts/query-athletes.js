require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  // Query athletes to delete (coaches + female)
  const toDeleteGroups = [
    { team: 'Penn State', names: ['Ethan Curl', 'Sean Schimmel'] },
    { team: 'Arizona State', names: ['Alex Sherman'] },
    { team: 'TCU', names: ['Anthony Crowder', 'James Winchester'] },
    { team: 'Army', names: ['Connor Dorff'] },
    { team: 'Southern Illinois', names: ['Tiago Faleiros', 'Tomáš Peciar'] },
    { team: 'North Carolina', names: ['Tom Mienis'] },
  ];

  console.log('=== TO DELETE (coaches + female) ===');
  for (const { team, names } of toDeleteGroups) {
    const { data: t } = await supabase.from('teams').select('id').eq('name', team).single();
    if (!t) { console.log('Team not found: ' + team); continue; }
    const { data } = await supabase.from('athletes').select('id, name').eq('team_id', t.id).in('name', names);
    console.log(team + ': ' + JSON.stringify(data?.map(a => ({ id: a.id, name: a.name }))));
  }

  // Query athletes with missing/broken photos
  const teamNames = ['Tennessee', 'Alabama', 'Missouri', 'Indiana', 'USC', 'Minnesota', 'Ohio State', 'Cal', 'Florida State', 'Stanford', 'Arizona State', 'Columbia'];
  console.log('\n=== PROFILE URLS FOR RESCRAPE ===');
  for (const teamName of teamNames) {
    const { data: t } = await supabase.from('teams').select('id').eq('name', teamName).single();
    if (!t) continue;
    const { data } = await supabase.from('athletes').select('id, name, photo_url, profile_url').eq('team_id', t.id).order('name');
    console.log('\n' + teamName + ' (' + data?.length + '):');
    data?.forEach(a => {
      const photoSnip = a.photo_url ? a.photo_url.substring(0, 70) : 'NULL';
      const profileSnip = a.profile_url ? a.profile_url.substring(0, 70) : 'NULL';
      console.log('  ' + a.name + '\n    photo: ' + photoSnip + '\n    profile: ' + profileSnip);
    });
  }
}
main().catch(console.error);
