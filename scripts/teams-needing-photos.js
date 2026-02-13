require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTeamPhotos() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, athlete_count, conference')
    .order('name');
  
  console.log('Analyzing photo coverage by team...\n');
  
  const teamStats = [];
  
  for (const team of teams) {
    const { data: athletes } = await supabase
      .from('athletes')
      .select('photo_url')
      .eq('team_id', team.id);
    
    const total = athletes.length;
    const withPhotos = athletes.filter(a => a.photo_url).length;
    const missing = total - withPhotos;
    const coverage = total > 0 ? ((withPhotos / total) * 100).toFixed(1) : 0;
    
    teamStats.push({
      name: team.name,
      conference: team.conference,
      total,
      withPhotos,
      missing,
      coverage: parseFloat(coverage)
    });
  }
  
  // Sort by most missing photos
  teamStats.sort((a, b) => b.missing - a.missing);
  
  console.log('='.repeat(70));
  console.log('TEAMS NEEDING MOST PHOTOS');
  console.log('='.repeat(70));
  console.log('');
  
  teamStats.filter(t => t.missing > 0).slice(0, 25).forEach(t => {
    const bar = '█'.repeat(Math.floor(t.coverage / 5)) + '░'.repeat(20 - Math.floor(t.coverage / 5));
    console.log(`${t.name.padEnd(25)} ${t.missing.toString().padStart(2)} missing  [${bar}] ${t.coverage}%`);
    console.log(`  ${t.conference.toUpperCase().padEnd(25)} ${t.withPhotos}/${t.total} athletes`);
    console.log('');
  });
  
  // Summary by conference
  console.log('='.repeat(70));
  console.log('SUMMARY BY CONFERENCE');
  console.log('='.repeat(70));
  
  const confStats = {};
  teamStats.forEach(t => {
    if (!confStats[t.conference]) {
      confStats[t.conference] = { total: 0, withPhotos: 0, teams: 0 };
    }
    confStats[t.conference].total += t.total;
    confStats[t.conference].withPhotos += t.withPhotos;
    confStats[t.conference].teams++;
  });
  
  Object.entries(confStats).forEach(([conf, stats]) => {
    const coverage = ((stats.withPhotos / stats.total) * 100).toFixed(1);
    const missing = stats.total - stats.withPhotos;
    console.log(`${conf.toUpperCase().padEnd(12)} ${stats.withPhotos}/${stats.total} athletes (${coverage}%), ${missing} missing, ${stats.teams} teams`);
  });
}

analyzeTeamPhotos();
