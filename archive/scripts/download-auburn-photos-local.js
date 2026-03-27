require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Auburn male athletes
const auburnMaleAthletes = [
  { name: "Maston Ballew", photoUrl: "https://auburntigers.com/images/2025/10/15/maston-ballew.jpg", slug: "maston-ballew" },
  { name: "Luke Bedsole", photoUrl: "https://auburntigers.com/images/2025/10/15/luke-bedsole.jpg", slug: "luke-bedsole" },
  { name: "Talan Blackmon", photoUrl: "https://auburntigers.com/images/2025/10/15/talan-blackmon.jpg", slug: "talan-blackmon" },
  { name: "Tate Cutler", photoUrl: "https://auburntigers.com/images/2025/10/15/tate-cutler.jpg", slug: "tate-cutler" },
  { name: "Sam Empey", photoUrl: "https://auburntigers.com/images/2025/10/15/sam-empey.jpg", slug: "sam-empey" },
  { name: "Tsvetomir Ereminov", photoUrl: "https://auburntigers.com/images/2025/10/15/tsvetomir-ereminov.jpg", slug: "tsvetomir-ereminov" },
  { name: "Rokas Jazdauskas", photoUrl: "https://auburntigers.com/images/2025/10/15/rokas-jazdauskas.jpg", slug: "rokas-jazdauskas" },
  { name: "Bradford Johnson", photoUrl: "https://auburntigers.com/images/2025/10/15/bradford-johnson.jpg", slug: "bradford-johnson" },
  { name: "Sohib Khaled", photoUrl: "https://auburntigers.com/images/2025/10/15/sohib-khaled-emam.jpg", slug: "sohib-khaled-emam" },
  { name: "Daniel Krichevsky", photoUrl: "https://auburntigers.com/images/2025/10/15/daniel-krichevsky.jpg", slug: "daniel-krichevsky" },
  { name: "Kalle Makinen", photoUrl: "https://auburntigers.com/images/2025/10/15/kalle-makinen.jpg", slug: "kalle-makinen" },
  { name: "Abdalla Nasr", photoUrl: "https://auburntigers.com/images/2025/10/15/abdalla-nasr.jpg", slug: "abdalla-nasr" },
  { name: "River Paulk", photoUrl: "https://auburntigers.com/images/2025/10/15/river-paulk.jpg", slug: "river-paulk" },
  { name: "Warner Russ", photoUrl: "https://auburntigers.com/images/2025/10/15/warner-russ.jpg", slug: "warner-russ" },
  { name: "Danny Schmidt", photoUrl: "https://auburntigers.com/images/2025/10/15/danny-schmidt.jpg", slug: "danny-schmidt" },
  { name: "Mack Schumann", photoUrl: "https://auburntigers.com/images/2025/10/15/mack-schumann.jpg", slug: "mack-schumann" },
  { name: "Ethan Swart", photoUrl: "https://auburntigers.com/images/2025/10/15/ethan-swart.jpg", slug: "ethan-swart" },
  { name: "Ivan Tarasov", photoUrl: "https://auburntigers.com/images/2025/10/15/ivan-tarasov.jpg", slug: "ivan-tarasov" },
  { name: "Jon Vanzandt", photoUrl: "https://auburntigers.com/images/2025/10/15/jon-vanzandt.jpg", slug: "jon-vanzandt" },
  { name: "Luke Waldrep", photoUrl: "https://auburntigers.com/images/2025/10/15/luke-waldrep.jpg", slug: "luke-waldrep" },
  { name: "Ben Wilson", photoUrl: "https://auburntigers.com/images/2025/10/15/ben-wilson.jpg", slug: "ben-wilson" },
  { name: "Uros Zivanovic", photoUrl: "https://auburntigers.com/images/2025/10/15/uros-zivanovic.jpg", slug: "uros-zivanovic" },
];

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://auburntigers.com/',
      }
    };

    https.get(url, options, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`Failed: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function downloadAndUpdateAuburnPhotos() {
  console.log('Starting Auburn photo download...\n');

  // Create auburn photos directory
  const auburnDir = path.join(__dirname, '..', 'public', 'athletes', 'auburn');
  if (!fs.existsSync(auburnDir)) {
    fs.mkdirSync(auburnDir, { recursive: true });
  }

  // Get Auburn team ID
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'Auburn')
    .single();

  if (!team) {
    console.error('Auburn team not found');
    return;
  }

  let downloaded = 0;
  let failed = 0;

  for (const athlete of auburnMaleAthletes) {
    try {
      const filename = `${athlete.slug}.jpg`;
      const filepath = path.join(auburnDir, filename);

      console.log(`Downloading: ${athlete.name}...`);
      await downloadImage(athlete.photoUrl, filepath);

      // Update database with local URL
      const localUrl = `/athletes/auburn/${filename}`;
      const { data: existingAthlete } = await supabase
        .from('athletes')
        .select('id')
        .eq('team_id', team.id)
        .eq('name', athlete.name)
        .single();

      if (existingAthlete) {
        await supabase
          .from('athletes')
          .update({ photo_url: localUrl })
          .eq('id', existingAthlete.id);

        console.log(`✅ Downloaded and updated: ${athlete.name}`);
        downloaded++;
      }
    } catch (error) {
      console.error(`❌ Failed: ${athlete.name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${auburnMaleAthletes.length}`);
}

downloadAndUpdateAuburnPhotos();
