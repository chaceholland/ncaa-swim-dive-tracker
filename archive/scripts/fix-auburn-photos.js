require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Auburn male athletes with their photo URLs
const auburnMaleAthletes = [
  { name: "Maston Ballew", photoUrl: "https://auburntigers.com/images/2025/10/15/maston-ballew.jpg" },
  { name: "Luke Bedsole", photoUrl: "https://auburntigers.com/images/2025/10/15/luke-bedsole.jpg" },
  { name: "Talan Blackmon", photoUrl: "https://auburntigers.com/images/2025/10/15/talan-blackmon.jpg" },
  { name: "Tate Cutler", photoUrl: "https://auburntigers.com/images/2025/10/15/tate-cutler.jpg" },
  { name: "Sam Empey", photoUrl: "https://auburntigers.com/images/2025/10/15/sam-empey.jpg" },
  { name: "Tsvetomir Ereminov", photoUrl: "https://auburntigers.com/images/2025/10/15/tsvetomir-ereminov.jpg" },
  { name: "Rokas Jazdauskas", photoUrl: "https://auburntigers.com/images/2025/10/15/rokas-jazdauskas.jpg" },
  { name: "Bradford Johnson", photoUrl: "https://auburntigers.com/images/2025/10/15/bradford-johnson.jpg" },
  { name: "Sohib Khaled", photoUrl: "https://auburntigers.com/images/2025/10/15/sohib-khaled-emam.jpg" },
  { name: "Daniel Krichevsky", photoUrl: "https://auburntigers.com/images/2025/10/15/daniel-krichevsky.jpg" },
  { name: "Kalle Makinen", photoUrl: "https://auburntigers.com/images/2025/10/15/kalle-makinen.jpg" },
  { name: "Abdalla Nasr", photoUrl: "https://auburntigers.com/images/2025/10/15/abdalla-nasr.jpg" },
  { name: "River Paulk", photoUrl: "https://auburntigers.com/images/2025/10/15/river-paulk.jpg" },
  { name: "Warner Russ", photoUrl: "https://auburntigers.com/images/2025/10/15/warner-russ.jpg" },
  { name: "Danny Schmidt", photoUrl: "https://auburntigers.com/images/2025/10/15/danny-schmidt.jpg" },
  { name: "Mack Schumann", photoUrl: "https://auburntigers.com/images/2025/10/15/mack-schumann.jpg" },
  { name: "Ethan Swart", photoUrl: "https://auburntigers.com/images/2025/10/15/ethan-swart.jpg" },
  { name: "Ivan Tarasov", photoUrl: "https://auburntigers.com/images/2025/10/15/ivan-tarasov.jpg" },
  { name: "Jon Vanzandt", photoUrl: "https://auburntigers.com/images/2025/10/15/jon-vanzandt.jpg" },
  { name: "Luke Waldrep", photoUrl: "https://auburntigers.com/images/2025/10/15/luke-waldrep.jpg" },
  { name: "Ben Wilson", photoUrl: "https://auburntigers.com/images/2025/10/15/ben-wilson.jpg" },
  { name: "Uros Zivanovic", photoUrl: "https://auburntigers.com/images/2025/10/15/uros-zivanovic.jpg" },
];

async function fixAuburnPhotos() {
  console.log('Starting Auburn photo URL updates...\n');

  // Get Auburn team ID
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Auburn')
    .single();

  if (teamError || !team) {
    console.error('Error finding Auburn team:', teamError);
    return;
  }

  console.log(`Found team: ${team.name} (ID: ${team.id})\n`);

  let updated = 0;
  let notFound = 0;

  for (const athlete of auburnMaleAthletes) {
    // Find the athlete by name and team
    const { data: existingAthlete, error: findError } = await supabase
      .from('athletes')
      .select('id, name, photo_url')
      .eq('team_id', team.id)
      .eq('name', athlete.name)
      .single();

    if (findError || !existingAthlete) {
      console.log(`❌ Not found: ${athlete.name}`);
      notFound++;
      continue;
    }

    // Update the photo URL
    const { error: updateError } = await supabase
      .from('athletes')
      .update({ photo_url: athlete.photoUrl })
      .eq('id', existingAthlete.id);

    if (updateError) {
      console.error(`Error updating ${athlete.name}:`, updateError);
    } else {
      console.log(`✅ Updated: ${athlete.name}`);
      updated++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Total: ${auburnMaleAthletes.length}`);
}

fixAuburnPhotos();
