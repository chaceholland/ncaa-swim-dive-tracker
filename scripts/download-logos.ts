import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const espnTeamIds: Record<string, string> = {
  'Florida': '57', 'Texas': '251', 'Alabama': '333', 'Auburn': '2',
  'Georgia': '61', 'Tennessee': '2633', 'Missouri': '142', 'Kentucky': '96',
  'LSU': '99', 'South Carolina': '2579', 'Texas A&M': '245',
  'Virginia': '258', 'NC State': '152', 'Notre Dame': '87', 'Pittsburgh': '221',
  'Louisville': '97', 'Virginia Tech': '259', 'Florida State': '52', 'Duke': '150',
  'North Carolina': '153', 'Boston College': '103', 'Georgia Tech': '59',
  'Stanford': '24', 'Cal': '25', 'SMU': '2567',
  'Indiana': '84', 'Ohio State': '194', 'Michigan': '130', 'Penn State': '213',
  'Northwestern': '77', 'Minnesota': '135', 'Purdue': '2509', 'Wisconsin': '275', 'USC': '30',
  'Arizona State': '9', 'West Virginia': '277', 'TCU': '2628', 'Utah': '254', 'Arizona': '12',
  'Harvard': '108', 'Yale': '43', 'Princeton': '163', 'Columbia': '171',
  'Penn': '219', 'Cornell': '167', 'Brown': '225', 'Dartmouth': '159',
  'Navy': '2426', 'Army': '349',
  'George Washington': '45', 'Towson': '119', 'Southern Illinois': '79', 'UNLV': '2439',
};

function downloadLogo(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function downloadAllLogos() {
  console.log('Starting logo download...\n');

  const logosDir = path.join(process.cwd(), 'public', 'logos');
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const [teamName, espnId] of Object.entries(espnTeamIds)) {
    const url = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;
    const filename = `${teamName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    const filepath = path.join(logosDir, filename);
    const publicPath = `/logos/${filename}`;

    try {
      await downloadLogo(url, filepath);

      // Update database with local path
      const { error } = await supabase
        .from('teams')
        .update({ logo_url: publicPath })
        .eq('name', teamName);

      if (error) {
        console.error(`❌ Error updating ${teamName}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Downloaded and updated: ${teamName}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Failed to download ${teamName}: ${(err as Error).message}`);
      errorCount++;
    }

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nDownload complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total: ${Object.keys(espnTeamIds).length}`);
}

downloadAllLogos()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
