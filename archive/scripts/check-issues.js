const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const femaleNames = [
  'abigail', 'amanda', 'amy', 'andrea', 'angela', 'anna', 'annika', 'ashley', 'audrey',
  'bella', 'brittany', 'carissa', 'casey', 'chloe', 'christina', 'claire', 'coco',
  'daniela', 'danielle', 'elizabeth', 'elizaveta', 'ellis', 'emily', 'emma',
  'hanna', 'hannah', 'heather', 'izzy', 'jennifer', 'jessica', 'julia', 'juliette',
  'kate', 'katie', 'kayla', 'kiia', 'kyla', 'kyleigh',
  'lilly', 'lindsay', 'lora', 'maggie', 'maria', 'mary', 'megan', 'michelle', 'morgan',
  'nicole', 'nora', 'olivia', 'rachel', 'rebecca', 'rosalie', 'sammie', 'samantha', 
  'sarah', 'sophia', 'stephanie', 'taylor', 'tiffany', 'wyllo', 'zoey', 'ava'
];

function isPossiblyFemale(name) {
  const firstName = name.toLowerCase().split(' ')[0];
  return femaleNames.includes(firstName);
}

async function checkIssues() {
  // Check Texas A&M
  console.log('\n=== TEXAS A&M ===');
  const { data: tamTeam } = await supabase.from('teams').select('id').eq('name', 'Texas A&M').single();
  const { data: tamAthletes } = await supabase
    .from('athletes')
    .select('id, name, athlete_type')
    .eq('team_id', tamTeam.id)
    .order('name');
  
  console.log(`Total: ${tamAthletes.length}`);
  const tamWomen = tamAthletes.filter(a => isPossiblyFemale(a.name));
  if (tamWomen.length > 0) {
    console.log(`\nWomen found (${tamWomen.length}):`);
    tamWomen.forEach(a => console.log(`  - ${a.name}`));
  }

  // Check Tennessee
  console.log('\n\n=== TENNESSEE ===');
  const { data: tennTeam } = await supabase.from('teams').select('id').eq('name', 'Tennessee').single();
  const { data: tennAthletes } = await supabase
    .from('athletes')
    .select('id, name, athlete_type, hometown')
    .eq('team_id', tennTeam.id)
    .order('name');
  
  console.log(`Total: ${tennAthletes.length}`);
  
  // Check for divers tagged as swimmers by looking for "diving" in name/hometown
  const possibleDivers = tennAthletes.filter(a => 
    a.athlete_type === 'swimmer' && 
    (a.name.toLowerCase().includes('div') || (a.hometown && a.hometown.toLowerCase().includes('div')))
  );
  
  if (possibleDivers.length > 0) {
    console.log(`\nPossible divers tagged as swimmers (${possibleDivers.length}):`);
    possibleDivers.forEach(a => console.log(`  - ${a.name} (${a.hometown || 'no hometown'})`));
  }

  const divers = tennAthletes.filter(a => a.athlete_type === 'diver');
  const swimmers = tennAthletes.filter(a => a.athlete_type === 'swimmer');
  console.log(`\nDivers: ${divers.length}`);
  console.log(`Swimmers: ${swimmers.length}`);
}

checkIssues();
