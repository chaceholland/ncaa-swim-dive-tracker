const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDivers() {
  const { data: tennTeam } = await supabase.from('teams').select('id').eq('name', 'Tennessee').single();
  
  // Find athletes with "diving" in hometown (which is actually position)
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, hometown')
    .eq('team_id', tennTeam.id)
    .eq('athlete_type', 'swimmer')
    .ilike('hometown', '%diving%');

  console.log(`Found ${athletes.length} divers to fix:`);
  athletes.forEach(a => console.log(`  - ${a.name}`));

  // Update them to divers
  for (const athlete of athletes) {
    await supabase
      .from('athletes')
      .update({ athlete_type: 'diver' })
      .eq('id', athlete.id);
  }

  console.log(`\n✅ Updated ${athletes.length} athletes to divers`);
}

fixDivers();
