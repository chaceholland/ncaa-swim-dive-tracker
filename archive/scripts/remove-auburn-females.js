require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const femaleNames = [
  'Lilly Gault Abdella', 'Taylor Bacher', 'Chloe Brothers', 'Morgan Carteaux',
  'Audrey Crawford', 'Coco Croxford', 'Casey Cullen', 'Olivia Dinehart',
  'Bella Ekk', 'Maria Faoro', 'Annika Finzen', 'Ellis Fox',
  'Emily Hallifax', 'Sammie Hamilton', 'Wyllo Hanson', 'Abigail Heizer',
  'Izzy Iwasyk', 'Kyleigh Kidd', 'Elizaveta Klevanovich', 'Lora Komoroczy',
  'Juliette Landi', 'Kyla Maloney', 'Maggie McGuire', 'Kiia Metsakonkola',
  'Kate Murray', 'Rosalie Reef', 'Carissa Rinard', 'Hanna Schmidt',
  'Julia Strojnowska', 'Nora Weber', 'Zoey Zeller'
];

async function removeFemales() {
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Auburn')
    .single();

  console.log('Removing female athletes from Auburn...\n');

  for (const name of femaleNames) {
    const { error } = await supabase
      .from('athletes')
      .delete()
      .eq('team_id', team.id)
      .eq('name', name);

    if (error) {
      console.log(`  ⚠️  ${name}: ${error.message}`);
    } else {
      console.log(`  ✅ Removed: ${name}`);
    }
  }

  console.log(`\n✅ Complete`);
}

removeFemales();
