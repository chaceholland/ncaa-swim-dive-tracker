// Fix athletes that already have profile_urls but bad photos:
// Missouri (5), Alabama (Cryer + Chambers), Tennessee (Dumesnil)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Athletes to fix: { team, name }
const TARGET_ATHLETES = [
  { team: 'Missouri', name: 'Collier Dyer' },
  { team: 'Missouri', name: 'Luke Nebrich' },
  { team: 'Missouri', name: 'Oliver Millán de Miguel' },
  { team: 'Missouri', name: 'Tanner Braunton' },
  { team: 'Missouri', name: 'Tommaso Zannella' },
  { team: 'Alabama', name: 'Colten Cryer' },
  { team: 'Alabama', name: 'Nigel Chambers' },
  { team: 'Tennessee', name: 'Ethan Dumesnil' },
];

async function scrapeAthletePhoto(page, profileUrl) {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const candidates = images
        .filter(img => {
          const src = img.src || img.getAttribute('data-src') || '';
          // Look for direct CDN URLs (cloudfront, team domain images)
          const isCloudfront = src.includes('cloudfront.net');
          const isTeamImage = src.includes('/images/20') && !src.includes('sidearmdev');
          if (!isCloudfront && !isTeamImage) return false;
          if (src.includes('/logos/') || src.includes('logo') || src.includes('site.png')
              || src.includes('.svg') || src.includes('footer_') || src.includes('sponsor')) return false;
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
    });

    if (photoUrl) {
      try {
        const url = new URL(photoUrl);
        url.searchParams.set('width', '1920');
        return url.toString();
      } catch {
        return photoUrl;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('\n🔧 Fixing athletes with existing profile URLs\n');

  // Load all target athletes from DB
  const athletes = [];
  for (const target of TARGET_ATHLETES) {
    const { data: team } = await supabase.from('teams').select('id, logo_url').eq('name', target.team).single();
    if (!team) { console.log('Team not found: ' + target.team); continue; }
    const { data: a } = await supabase.from('athletes').select('id, name, profile_url, photo_url')
      .eq('team_id', team.id).eq('name', target.name).single();
    if (!a) { console.log('Athlete not found: ' + target.name + ' (' + target.team + ')'); continue; }
    if (!a.profile_url) { console.log('No profile_url: ' + target.name + ' (' + target.team + ')'); continue; }
    athletes.push({ ...a, team: target.team, logo_url: team.logo_url });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const athlete of athletes) {
    const photoUrl = await scrapeAthletePhoto(page, athlete.profile_url);
    const status = photoUrl ? '✅' : '❌ no photo';
    console.log(`${athlete.team} - ${athlete.name}: ${status}`);
    if (photoUrl && photoUrl !== athlete.photo_url) {
      await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', athlete.id);
    } else if (!photoUrl) {
      console.log(`  profile_url: ${athlete.profile_url}`);
    }
  }

  await browser.close();
  console.log('\nDone.');
}
main().catch(console.error);
