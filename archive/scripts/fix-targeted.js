// Fix specific athletes with now-known profile URLs
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TARGETS = [
  {
    team: 'Florida State',
    name: 'Aidan Siers',
    profileUrl: 'https://seminoles.com/sports/mens-swimming-and-diving/roster/aidan-siers/8313',
    hostFilter: ['cloudfront.net', 'seminoles.com/images/'],
  },
  {
    team: 'Arizona State',
    name: 'Caleb Liban',
    profileUrl: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster/player/caleb-liban',
    hostFilter: ['googleapis.com', 'thesundevils.com/images/'],
  },
];

async function scrapePhoto(page, profileUrl, hostFilter) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const photoUrl = await page.evaluate((hosts) => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || img.getAttribute('data-src') || '';
          if (!hosts.some(h => src.includes(h))) return false;
          if (src.includes('/logos/') || src.includes('logo') || src.includes('site.png')
              || src.includes('.svg') || src.includes('footer_') || src.includes('sponsor')
              || src.includes('wordmark') || src.includes('/staff/')) return false;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w < 80 || h < 80) return false;
          const ratio = w / h;
          return ratio >= 0.4 && ratio <= 1.1;
        })
        .map(img => ({
          src: img.src || img.getAttribute('data-src') || '',
          area: (img.naturalWidth || img.width || 1) * (img.naturalHeight || img.height || 1)
        }))
        .sort((a, b) => b.area - a.area);
      return candidates[0]?.src || null;
    }, hostFilter);

    if (photoUrl) {
      try {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        return url.toString();
      } catch { return photoUrl; }
    }

    // Broader fallback: any portrait-ratio image
    return await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const skip = ['.svg', 'logo', 'footer', 'sponsor', 'wordmark', 'icon', 'brand'];
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          if (!src.startsWith('http')) return false;
          if (skip.some(s => src.toLowerCase().includes(s))) return false;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w < 100 || h < 100) return false;
          const ratio = w / h;
          return ratio >= 0.4 && ratio <= 1.0;
        })
        .map(img => ({
          src: img.src,
          area: (img.naturalWidth || img.width || 1) * (img.naturalHeight || img.height || 1)
        }))
        .sort((a, b) => b.area - a.area);
      return candidates[0]?.src || null;
    });
  } catch { return null; }
}

async function main() {
  console.log('\n🔧 Targeted athlete fixes\n');

  // Delete Derrick Butts (Columbia) - he's a coach
  const { data: columbia } = await supabase.from('teams').select('id').eq('name', 'Columbia').single();
  if (columbia) {
    const { error } = await supabase.from('athletes').delete()
      .eq('team_id', columbia.id).eq('name', 'Derrick Butts');
    if (error) console.log('Error deleting Derrick Butts:', error.message);
    else console.log('Deleted: Derrick Butts (Columbia) - was a coach');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const t of TARGETS) {
    const { data: team } = await supabase.from('teams').select('id, logo_url').eq('name', t.team).single();
    if (!team) { console.log(`Team not found: ${t.team}`); continue; }
    const { data: a } = await supabase.from('athletes').select('id, name')
      .eq('team_id', team.id).eq('name', t.name).single();
    if (!a) { console.log(`Athlete not found: ${t.name}`); continue; }

    const photoUrl = await scrapePhoto(page, t.profileUrl, t.hostFilter);
    const finalPhoto = photoUrl || team.logo_url;
    await supabase.from('athletes').update({ photo_url: finalPhoto, profile_url: t.profileUrl }).eq('id', a.id);
    console.log(`${t.team} - ${t.name}: ${photoUrl ? '✅ ' + photoUrl.substring(0, 60) : '❌ no photo (logo used)'}`);
  }

  await browser.close();
  console.log('\nDone.');
}
main().catch(console.error);
