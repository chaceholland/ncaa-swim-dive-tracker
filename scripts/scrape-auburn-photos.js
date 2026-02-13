require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Auburn male athletes with their slugs
const auburnMaleAthletes = [
  { name: "Maston Ballew", slug: "maston-ballew" },
  { name: "Luke Bedsole", slug: "luke-bedsole" },
  { name: "Talan Blackmon", slug: "talan-blackmon" },
  { name: "Tate Cutler", slug: "tate-cutler" },
  { name: "Sam Empey", slug: "sam-empey" },
  { name: "Tsvetomir Ereminov", slug: "tsvetomir-ereminov" },
  { name: "Rokas Jazdauskas", slug: "rokas-jazdauskas" },
  { name: "Bradford Johnson", slug: "bradford-johnson" },
  { name: "Sohib Khaled", slug: "sohib-khaled-emam" },
  { name: "Daniel Krichevsky", slug: "daniel-krichevsky" },
  { name: "Kalle Makinen", slug: "kalle-makinen" },
  { name: "Abdalla Nasr", slug: "abdalla-nasr" },
  { name: "River Paulk", slug: "river-paulk" },
  { name: "Warner Russ", slug: "warner-russ" },
  { name: "Danny Schmidt", slug: "danny-schmidt" },
  { name: "Mack Schumann", slug: "mack-schumann" },
  { name: "Ethan Swart", slug: "ethan-swart" },
  { name: "Ivan Tarasov", slug: "ivan-tarasov" },
  { name: "Jon Vanzandt", slug: "jon-vanzandt" },
  { name: "Luke Waldrep", slug: "luke-waldrep" },
  { name: "Ben Wilson", slug: "ben-wilson" },
  { name: "Uros Zivanovic", slug: "uros-zivanovic" },
];

async function scrapeAthletePhoto(page, slug) {
  const url = `https://auburntigers.com/sports/swimming-diving/roster/player/${slug}`;

  try {
    // Listen for image requests
    const imgProxyPromise = page.waitForResponse(
      response => response.url().includes('imgproxy') && response.status() === 200,
      { timeout: 15000 }
    ).catch(() => null);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      const img = document.querySelector('img.roster-bio-photo__image') ||
                   document.querySelector('img.v-lazy-image');
      if (img) {
        img.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });

    // Wait for the imgproxy image to load and return URL from network response
    const imgResponse = await imgProxyPromise;
    if (imgResponse) {
      const photoUrl = imgResponse.url();
      console.log(`  ✓ Captured imgproxy URL: ${photoUrl.substring(0, 80)}...`);
      return photoUrl;
    }

    console.log(`  ✗ No imgproxy response detected`);
    return null;
  } catch (error) {
    console.error(`Error scraping ${slug}: ${error.message}`);
    return null;
  }
}

async function scrapeAndUpdateAuburnPhotos() {
  console.log('Starting Auburn photo scraping with Playwright...\n');

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Get Auburn team ID
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('name', 'Auburn')
    .single();

  if (!team) {
    console.error('Auburn team not found');
    await browser.close();
    return;
  }

  console.log(`Found team: ${team.name} (ID: ${team.id})\n`);

  let updated = 0;
  let failed = 0;
  let notFound = 0;

  for (const athlete of auburnMaleAthletes) {
    try {
      console.log(`Scraping: ${athlete.name}...`);

      // Scrape the photo URL
      const photoUrl = await scrapeAthletePhoto(page, athlete.slug);

      if (!photoUrl) {
        console.log(`❌ No photo found: ${athlete.name}`);
        failed++;
        continue;
      }

      console.log(`  Found URL: ${photoUrl.substring(0, 80)}...`);

      // Find the athlete in database
      const { data: existingAthlete, error: findError } = await supabase
        .from('athletes')
        .select('id, name, photo_url')
        .eq('team_id', team.id)
        .eq('name', athlete.name)
        .single();

      if (findError || !existingAthlete) {
        console.log(`❌ Not found in database: ${athlete.name}`);
        notFound++;
        continue;
      }

      // Update the photo URL
      const { error: updateError } = await supabase
        .from('athletes')
        .update({ photo_url: photoUrl })
        .eq('id', existingAthlete.id);

      if (updateError) {
        console.error(`❌ Error updating ${athlete.name}: ${updateError.message}`);
        failed++;
      } else {
        console.log(`✅ Updated: ${athlete.name}`);
        updated++;
      }

      // Add a small delay to be polite to the server
      await page.waitForTimeout(1000);

    } catch (error) {
      console.error(`❌ Failed: ${athlete.name} - ${error.message}`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Not found in DB: ${notFound}`);
  console.log(`   Total: ${auburnMaleAthletes.length}`);
}

scrapeAndUpdateAuburnPhotos().catch(console.error);
