import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Map team names to their Loodibee logo URLs
const logoMappings: Record<string, { logo: string; fallback?: string }> = {
  // SEC
  'Florida': {
    logo: 'https://loodibee.com/wp-content/uploads/Florida_Gators_logo.png',
  },
  'Texas': {
    logo: 'https://loodibee.com/wp-content/uploads/Texas_Longhorns_logo.png',
  },
  'Alabama': {
    logo: 'https://loodibee.com/wp-content/uploads/Alabama_Crimson_Tide_logo.png',
  },
  'Auburn': {
    logo: 'https://loodibee.com/wp-content/uploads/Auburn_Tigers_logo.png',
  },
  'Georgia': {
    logo: 'https://loodibee.com/wp-content/uploads/Georgia_Bulldogs_logo.png',
  },
  'Tennessee': {
    logo: 'https://loodibee.com/wp-content/uploads/Tennessee_Volunteers_logo.png',
  },
  'Missouri': {
    logo: 'https://loodibee.com/wp-content/uploads/Missouri_Tigers_logo.png',
  },
  'Kentucky': {
    logo: 'https://loodibee.com/wp-content/uploads/Kentucky_Wildcats_logo.png',
  },
  'LSU': {
    logo: 'https://loodibee.com/wp-content/uploads/LSU_Tigers_logo.png',
  },
  'South Carolina': {
    logo: 'https://loodibee.com/wp-content/uploads/South_Carolina_Gamecocks_logo.png',
  },
  'Texas A&M': {
    logo: 'https://loodibee.com/wp-content/uploads/Texas_A_M_Aggies_logo.png',
  },

  // ACC
  'Virginia': {
    logo: 'https://loodibee.com/wp-content/uploads/Virginia_Cavaliers_logo.png',
  },
  'NC State': {
    logo: 'https://loodibee.com/wp-content/uploads/NC_State_Wolfpack_logo.png',
  },
  'Notre Dame': {
    logo: 'https://loodibee.com/wp-content/uploads/Notre_Dame_Fighting_Irish_logo.png',
  },
  'Pittsburgh': {
    logo: 'https://loodibee.com/wp-content/uploads/Pittsburgh_Panthers_logo.png',
  },
  'Louisville': {
    logo: 'https://loodibee.com/wp-content/uploads/Louisville_Cardinals_logo.png',
  },
  'Virginia Tech': {
    logo: 'https://loodibee.com/wp-content/uploads/Virginia_Tech_Hokies_logo.png',
  },
  'Florida State': {
    logo: 'https://loodibee.com/wp-content/uploads/Florida_State_Seminoles_logo.png',
  },
  'Duke': {
    logo: 'https://loodibee.com/wp-content/uploads/Duke_Blue_Devils_logo.png',
  },
  'North Carolina': {
    logo: 'https://loodibee.com/wp-content/uploads/North_Carolina_Tar_Heels_logo.png',
  },
  'Boston College': {
    logo: 'https://loodibee.com/wp-content/uploads/Boston_College_Eagles_logo.png',
  },
  'Georgia Tech': {
    logo: 'https://loodibee.com/wp-content/uploads/Georgia_Tech_Yellow_Jackets_logo.png',
  },
  'Stanford': {
    logo: 'https://loodibee.com/wp-content/uploads/Stanford_Cardinal_logo.png',
  },
  'Cal': {
    logo: 'https://loodibee.com/wp-content/uploads/California_Golden_Bears_logo.png',
  },
  'SMU': {
    logo: 'https://loodibee.com/wp-content/uploads/SMU_Mustangs_logo.png',
  },

  // Big Ten
  'Indiana': {
    logo: 'https://loodibee.com/wp-content/uploads/Indiana_Hoosiers_logo.png',
  },
  'Ohio State': {
    logo: 'https://loodibee.com/wp-content/uploads/Ohio_State_Buckeyes_logo.png',
  },
  'Michigan': {
    logo: 'https://loodibee.com/wp-content/uploads/Michigan_Wolverines_logo.png',
  },
  'Penn State': {
    logo: 'https://loodibee.com/wp-content/uploads/Penn_State_Nittany_Lions_logo.png',
  },
  'Northwestern': {
    logo: 'https://loodibee.com/wp-content/uploads/Northwestern_Wildcats_logo.png',
  },
  'Minnesota': {
    logo: 'https://loodibee.com/wp-content/uploads/Minnesota_Golden_Gophers_logo.png',
  },
  'Purdue': {
    logo: 'https://loodibee.com/wp-content/uploads/Purdue_Boilermakers_logo.png',
  },
  'Wisconsin': {
    logo: 'https://loodibee.com/wp-content/uploads/Wisconsin_Badgers_logo.png',
  },
  'USC': {
    logo: 'https://loodibee.com/wp-content/uploads/USC_Trojans_logo.png',
  },

  // Big 12
  'Arizona State': {
    logo: 'https://loodibee.com/wp-content/uploads/Arizona_State_Sun_Devils_logo.png',
  },
  'West Virginia': {
    logo: 'https://loodibee.com/wp-content/uploads/West_Virginia_Mountaineers_logo.png',
  },
  'TCU': {
    logo: 'https://loodibee.com/wp-content/uploads/TCU_Horned_Frogs_logo.png',
  },
  'Utah': {
    logo: 'https://loodibee.com/wp-content/uploads/Utah_Utes_logo.png',
  },
  'Arizona': {
    logo: 'https://loodibee.com/wp-content/uploads/Arizona_Wildcats_logo.png',
  },

  // Ivy League
  'Harvard': {
    logo: 'https://loodibee.com/wp-content/uploads/Harvard_Crimson_logo.png',
  },
  'Yale': {
    logo: 'https://loodibee.com/wp-content/uploads/Yale_Bulldogs_logo.png',
  },
  'Princeton': {
    logo: 'https://loodibee.com/wp-content/uploads/Princeton_Tigers_logo.png',
  },
  'Columbia': {
    logo: 'https://loodibee.com/wp-content/uploads/Columbia_Lions_logo.png',
  },
  'Penn': {
    logo: 'https://loodibee.com/wp-content/uploads/Penn_Quakers_logo.png',
  },
  'Cornell': {
    logo: 'https://loodibee.com/wp-content/uploads/Cornell_Big_Red_logo.png',
  },
  'Brown': {
    logo: 'https://loodibee.com/wp-content/uploads/Brown_Bears_logo.png',
  },
  'Dartmouth': {
    logo: 'https://loodibee.com/wp-content/uploads/Dartmouth_Big_Green_logo.png',
  },

  // Patriot League
  'Navy': {
    logo: 'https://loodibee.com/wp-content/uploads/Navy_Midshipmen_logo.png',
  },
  'Army': {
    logo: 'https://loodibee.com/wp-content/uploads/Army_Black_Knights_logo.png',
  },

  // Other
  'George Washington': {
    logo: 'https://loodibee.com/wp-content/uploads/George_Washington_Revolutionaries_logo.png',
  },
  'Towson': {
    logo: 'https://loodibee.com/wp-content/uploads/Towson_Tigers_logo.png',
  },
  'Southern Illinois': {
    logo: 'https://loodibee.com/wp-content/uploads/Southern_Illinois_Salukis_logo.png',
  },
  'UNLV': {
    logo: 'https://loodibee.com/wp-content/uploads/UNLV_Rebels_logo.png',
  },
};

async function updateLogos() {
  console.log('Starting logo update...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const [teamName, urls] of Object.entries(logoMappings)) {
    try {
      const { data, error } = await supabase
        .from('teams')
        .update({
          logo_url: urls.logo,
          logo_fallback_url: urls.fallback || null,
        })
        .eq('name', teamName)
        .select();

      if (error) {
        console.error(`❌ Error updating ${teamName}:`, error.message);
        errorCount++;
      } else if (data && data.length > 0) {
        console.log(`✅ Updated logo for: ${teamName}`);
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

  console.log(`\nLogo update complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total: ${Object.keys(logoMappings).length}`);
}

// Run the update
updateLogos()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
