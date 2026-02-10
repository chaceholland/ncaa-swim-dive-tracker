import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TeamData {
  name: string;
  conference: string;
  conference_display_name: string;
  primary_color: string;
  secondary_color: string;
  athlete_count: number;
}

const teamsData: TeamData[] = [
  // SEC
  { name: 'Florida', conference: 'sec', conference_display_name: 'SEC', primary_color: '#FA4616', secondary_color: '#0021A5', athlete_count: 0 },
  { name: 'Texas', conference: 'sec', conference_display_name: 'SEC', primary_color: '#BF5700', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Alabama', conference: 'sec', conference_display_name: 'SEC', primary_color: '#9E1B32', secondary_color: '#828A8F', athlete_count: 0 },
  { name: 'Auburn', conference: 'sec', conference_display_name: 'SEC', primary_color: '#0C2340', secondary_color: '#E87722', athlete_count: 0 },
  { name: 'Georgia', conference: 'sec', conference_display_name: 'SEC', primary_color: '#BA0C2F', secondary_color: '#000000', athlete_count: 0 },
  { name: 'Tennessee', conference: 'sec', conference_display_name: 'SEC', primary_color: '#FF8200', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Missouri', conference: 'sec', conference_display_name: 'SEC', primary_color: '#F1B82D', secondary_color: '#000000', athlete_count: 0 },
  { name: 'Kentucky', conference: 'sec', conference_display_name: 'SEC', primary_color: '#0033A0', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'LSU', conference: 'sec', conference_display_name: 'SEC', primary_color: '#461D7C', secondary_color: '#FDD023', athlete_count: 0 },
  { name: 'South Carolina', conference: 'sec', conference_display_name: 'SEC', primary_color: '#73000A', secondary_color: '#000000', athlete_count: 0 },
  { name: 'Texas A&M', conference: 'sec', conference_display_name: 'SEC', primary_color: '#500000', secondary_color: '#FFFFFF', athlete_count: 0 },

  // ACC
  { name: 'Virginia', conference: 'acc', conference_display_name: 'ACC', primary_color: '#232D4B', secondary_color: '#E57200', athlete_count: 0 },
  { name: 'NC State', conference: 'acc', conference_display_name: 'ACC', primary_color: '#CC0000', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Notre Dame', conference: 'acc', conference_display_name: 'ACC', primary_color: '#0C2340', secondary_color: '#C99700', athlete_count: 0 },
  { name: 'Pittsburgh', conference: 'acc', conference_display_name: 'ACC', primary_color: '#003594', secondary_color: '#FFB81C', athlete_count: 0 },
  { name: 'Louisville', conference: 'acc', conference_display_name: 'ACC', primary_color: '#AD0000', secondary_color: '#000000', athlete_count: 0 },
  { name: 'Virginia Tech', conference: 'acc', conference_display_name: 'ACC', primary_color: '#630031', secondary_color: '#CF4420', athlete_count: 0 },
  { name: 'Florida State', conference: 'acc', conference_display_name: 'ACC', primary_color: '#782F40', secondary_color: '#CEB888', athlete_count: 0 },
  { name: 'Duke', conference: 'acc', conference_display_name: 'ACC', primary_color: '#003087', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'North Carolina', conference: 'acc', conference_display_name: 'ACC', primary_color: '#7BAFD4', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Boston College', conference: 'acc', conference_display_name: 'ACC', primary_color: '#8A0A3C', secondary_color: '#FFC600', athlete_count: 0 },
  { name: 'Georgia Tech', conference: 'acc', conference_display_name: 'ACC', primary_color: '#B3A369', secondary_color: '#003057', athlete_count: 0 },
  { name: 'Stanford', conference: 'acc', conference_display_name: 'ACC', primary_color: '#8C1515', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Cal', conference: 'acc', conference_display_name: 'ACC', primary_color: '#003262', secondary_color: '#FDB515', athlete_count: 0 },
  { name: 'SMU', conference: 'acc', conference_display_name: 'ACC', primary_color: '#0033A0', secondary_color: '#CC0035', athlete_count: 0 },

  // Big Ten
  { name: 'Indiana', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#990000', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Ohio State', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#BB0000', secondary_color: '#666666', athlete_count: 0 },
  { name: 'Michigan', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#00274C', secondary_color: '#FFCB05', athlete_count: 0 },
  { name: 'Penn State', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#041E42', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Northwestern', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#4E2A84', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Minnesota', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#7A0019', secondary_color: '#FFCC33', athlete_count: 0 },
  { name: 'Purdue', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#000000', secondary_color: '#CFB991', athlete_count: 0 },
  { name: 'Wisconsin', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#C5050C', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'USC', conference: 'big-ten', conference_display_name: 'Big Ten', primary_color: '#990000', secondary_color: '#FFC72C', athlete_count: 0 },

  // Big 12
  { name: 'Arizona State', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#8C1D40', secondary_color: '#FFC627', athlete_count: 0 },
  { name: 'West Virginia', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#002855', secondary_color: '#EAAA00', athlete_count: 0 },
  { name: 'TCU', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#4D1979', secondary_color: '#A3A9AC', athlete_count: 0 },
  { name: 'Utah', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#CC0000', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Arizona', conference: 'big-12', conference_display_name: 'Big 12', primary_color: '#003366', secondary_color: '#CC0033', athlete_count: 0 },

  // Ivy League
  { name: 'Harvard', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#A51C30', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Yale', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#00356B', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Princeton', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#E77500', secondary_color: '#000000', athlete_count: 0 },
  { name: 'Columbia', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#B9D9EB', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Penn', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#011F5B', secondary_color: '#990000', athlete_count: 0 },
  { name: 'Cornell', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#B31B1B', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'Brown', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#4E3629', secondary_color: '#ED1C24', athlete_count: 0 },
  { name: 'Dartmouth', conference: 'ivy', conference_display_name: 'Ivy League', primary_color: '#00693E', secondary_color: '#FFFFFF', athlete_count: 0 },

  // Patriot League
  { name: 'Navy', conference: 'patriot', conference_display_name: 'Patriot League', primary_color: '#002D62', secondary_color: '#B3A369', athlete_count: 0 },
  { name: 'Army', conference: 'patriot', conference_display_name: 'Patriot League', primary_color: '#000000', secondary_color: '#D4AF37', athlete_count: 0 },

  // Other
  { name: 'George Washington', conference: 'other', conference_display_name: 'Atlantic 10', primary_color: '#033F63', secondary_color: '#AA9868', athlete_count: 0 },
  { name: 'Towson', conference: 'other', conference_display_name: 'Colonial Athletic', primary_color: '#FFAB00', secondary_color: '#000000', athlete_count: 0 },
  { name: 'Southern Illinois', conference: 'other', conference_display_name: 'Missouri Valley', primary_color: '#7C2529', secondary_color: '#FFFFFF', athlete_count: 0 },
  { name: 'UNLV', conference: 'other', conference_display_name: 'Mountain West', primary_color: '#CF0A2C', secondary_color: '#666666', athlete_count: 0 },
];

async function migrateTeams() {
  console.log('Starting team data migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const team of teamsData) {
    try {
      const { data, error } = await supabase
        .from('teams')
        .upsert(team, { onConflict: 'name' });

      if (error) {
        console.error(`Error migrating ${team.name}:`, error.message);
        errorCount++;
      } else {
        console.log(`Successfully migrated: ${team.name} (${team.conference_display_name})`);
        successCount++;
      }
    } catch (err) {
      console.error(`Exception migrating ${team.name}:`, err);
      errorCount++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total: ${teamsData.length}`);
}

// Run the migration
migrateTeams()
  .then(() => {
    console.log('\nAll done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
