require('dotenv').config({ path: '.env.local' });
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
  'sarah', 'sophia', 'stephanie', 'taylor', 'tiffany', 'wyllo', 'zoey', 'ava',
  'allyson', 'ella', 'eloise', 'giulia', 'halina', 'kailey', 'kaitlyn', 'kaylee',
  'lillie', 'lydia', 'macy', 'victoria', 'reagan', 'joslyn', 'julie', 'gabby',
  'bridget', 'blaire', 'celina'
];

function isPossiblyFemale(name) {
  const firstName = name.toLowerCase().split(' ')[0];
  return femaleNames.includes(firstName);
}

async function checkTexasAM() {
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Texas A&M')
    .single();

  if (!team) {
    console.log('Texas A&M not found');
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('team_id', team.id)
    .order('name');

  console.log(`\nTexas A&M has ${athletes.length} athletes total:\n`);

  const females = [];
  const males = [];

  athletes.forEach(athlete => {
    if (isPossiblyFemale(athlete.name)) {
      females.push(athlete.name);
    } else {
      males.push(athlete.name);
    }
  });

  if (females.length > 0) {
    console.log(`❌ FEMALES (${females.length}):`);
    females.forEach(name => console.log(`  - ${name}`));
    console.log('');
  }

  console.log(`✅ MALES (${males.length}):`);
  males.forEach(name => console.log(`  - ${name}`));
}

checkTexasAM();
