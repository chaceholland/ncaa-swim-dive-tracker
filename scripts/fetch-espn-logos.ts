import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ESPN team IDs for our teams (manually mapped)
const espnTeamIds: Record<string, string> = {
  // SEC
  'Florida': '57',
  'Texas': '251',
  'Alabama': '333',
  'Auburn': '2',
  'Georgia': '61',
  'Tennessee': '2633',
  'Missouri': '142',
  'Kentucky': '96',
  'LSU': '99',
  'South Carolina': '2579',
  'Texas A&M': '245',

  // ACC
  'Virginia': '258',
  'NC State': '152',
  'Notre Dame': '87',
  'Pittsburgh': '221',
  'Louisville': '97',
  'Virginia Tech': '259',
  'Florida State': '52',
  'Duke': '150',
  'North Carolina': '153',
  'Boston College': '103',
  'Georgia Tech': '59',
  'Stanford': '24',
  'Cal': '25',
  'SMU': '2567',

  // Big Ten
  'Indiana': '84',
  'Ohio State': '194',
  'Michigan': '130',
  'Penn State': '213',
  'Northwestern': '77',
  'Minnesota': '135',
  'Purdue': '2509',
  'Wisconsin': '275',
  'USC': '30',

  // Big 12
  'Arizona State': '9',
  'West Virginia': '277',
  'TCU': '2628',
  'Utah': '254',
  'Arizona': '12',

  // Ivy League
  'Harvard': '108',
  'Yale': '43',
  'Princeton': '163',
  'Columbia': '171',
  'Penn': '219',
  'Cornell': '167',
  'Brown': '225',
  'Dartmouth': '159',

  // Patriot League
  'Navy': '2426',
  'Army': '349',

  // Other
  'George Washington': '45', // Using GW's ID
  'Towson': '119',
  'Southern Illinois': '79',
  'UNLV': '2439',
};

async function updateLogosFromESPN() {
  console.log('Starting ESPN logo update...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const [teamName, espnId] of Object.entries(espnTeamIds)) {
    const logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;

    try {
      const { data, error } = await supabase
        .from('teams')
        .update({
          logo_url: logoUrl,
        })
        .eq('name', teamName)
        .select();

      if (error) {
        console.error(`❌ Error updating ${teamName}:`, error.message);
        errorCount++;
      } else if (data && data.length > 0) {
        console.log(`✅ Updated logo for: ${teamName} (ESPN ID: ${espnId})`);
        successCount++;
      } else {
        console.warn(`⚠️  Team not found: ${teamName}`);
        errorCount++;
      }
    } catch (err) {
      console.error(`❌ Exception updating ${teamName}:`, err);
      errorCount++;
    }
  }

  console.log(`\nESPN logo update complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total: ${Object.keys(espnTeamIds).length}`);
}

// Run the update
updateLogosFromESPN()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
