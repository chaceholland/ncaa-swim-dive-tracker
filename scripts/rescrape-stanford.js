require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Only update athletes that have bad/missing photos
const BAD_PHOTO_PATTERNS = ['ads.wmt.digital', 'espncdn.com', '/logos/', 'a.espncdn'];

async function scrapeAthletePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || '';
          if (!src.includes('googleapis.com') && !src.includes('gostanford.com/images/') && !src.includes('cloudfront.net')) return false;
          if (src.includes('/logos/') || src.includes('logo') || src.includes('site.png')
              || src.includes('.svg') || src.includes('footer_') || src.includes('sponsor')) return false;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w < 80 || h < 80) return false;
          const ratio = w / h;
          return ratio >= 0.4 && ratio <= 1.1;
        })
        .map(img => ({ src: img.src, area: (img.naturalWidth || img.width) * (img.naturalHeight || img.height) }))
        .sort((a, b) => b.area - a.area);
      return candidates[0]?.src || null;
    });
    return photoUrl || null;
  } catch { return null; }
}

async function main() {
  console.log('\n🔧 RESCRAPING: Stanford Men\'s Swimming & Diving\n');

  const { data: team } = await supabase.from('teams').select('id, logo_url').eq('name', 'Stanford').single();
  const { data: dbAthletes } = await supabase.from('athletes').select('id, name, photo_url, profile_url').eq('team_id', team.id);
  console.log(`DB athletes: ${dbAthletes.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://gostanford.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const rosterAthletes = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/roster/"]').forEach(a => {
      const href = a.href;
      if (!href || href.includes('/coaches/') || href.includes('/staff/') || href.includes('#')) return;
      if (seen.has(href)) return;
      const text = a.textContent?.trim();
      if (!text || text === 'View Full Bio' || text === 'Full Bio' || text === '') return;
      seen.add(href);
      const slug = href.split('/roster/')[1]?.split('/')[0] || '';
      const nameFromSlug = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      results.push({ profileUrl: href, name: text, nameFromSlug });
    });
    return results;
  });

  console.log(`Found ${rosterAthletes.length} athletes\n`);

  let updated = 0, inserted = 0, noPhoto = 0;

  for (const ra of rosterAthletes) {
    const match = dbAthletes?.find(a => {
      const db = a.name.toLowerCase().replace(/[\s'.-]+/g, '');
      const rn = (ra.name || '').toLowerCase().replace(/[\s'.-]+/g, '');
      const sl = (ra.nameFromSlug || '').toLowerCase().replace(/[\s'.-]+/g, '');
      return db === rn || db === sl || a.profile_url === ra.profileUrl;
    });

    // For existing athletes, only update if they have bad photos
    if (match) {
      const hasBadPhoto = !match.photo_url || BAD_PHOTO_PATTERNS.some(p => match.photo_url.includes(p));
      if (!hasBadPhoto) {
        // Still update profile_url if missing
        if (!match.profile_url) {
          await supabase.from('athletes').update({ profile_url: ra.profileUrl }).eq('id', match.id);
        }
        continue; // Don't re-scrape good photos
      }
    }

    const photoUrl = await scrapeAthletePhoto(page, ra.profileUrl);
    const finalPhoto = photoUrl || team.logo_url;
    if (!photoUrl) noPhoto++;

    if (match) {
      console.log(`${match.name}: ${photoUrl ? '✅' : '❌'}`);
      await supabase.from('athletes').update({ photo_url: finalPhoto, profile_url: ra.profileUrl }).eq('id', match.id);
      updated++;
    } else {
      console.log(`${ra.name} [NEW]: ${photoUrl ? '✅' : '❌'}`);
      const { error } = await supabase.from('athletes').insert({ name: ra.name, team_id: team.id, photo_url: finalPhoto, profile_url: ra.profileUrl });
      if (error) console.log(`  ⚠️ ${error.message}`);
      else inserted++;
    }
  }

  await browser.close();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Updated bad-photo athletes: ${updated}, Inserted: ${inserted}, No photo: ${noPhoto}`);
}
main().catch(console.error);
