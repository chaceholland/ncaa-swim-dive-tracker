// Try to get Stanford athlete photos from the roster page itself (thumbnail images)
// or by waiting longer on their single-page profile routes
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const BAD_ATHLETES = ['Henry McFadden', 'Henry Morrissey', 'Josh Zuchowski', 'Daniel Li', 'Ethan Harrington'];

async function main() {
  const { data: team } = await supabase.from('teams').select('id, logo_url').eq('name', 'Stanford').single();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading Stanford roster...');
  await page.goto('https://gostanford.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);

  // For each bad athlete, click their link and wait for the profile to load
  for (const athleteName of BAD_ATHLETES) {
    const { data: a } = await supabase.from('athletes').select('id, profile_url')
      .eq('team_id', team.id).eq('name', athleteName).single();
    if (!a) { console.log('Not found: ' + athleteName); continue; }

    // Navigate to their player page
    const slug = athleteName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
    const profileUrl = 'https://gostanford.com/sports/mens-swimming-and-diving/roster/player/' + slug;

    await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(5000); // More wait time for SPA

    const title = await page.title();
    console.log('\n' + athleteName + ' -> ' + title.substring(0, 80));

    // Get all images including those in data-src attributes
    const imgs = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-srcset') || '';
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (src && (w > 100 || h > 100)) {
          results.push({ src: src.substring(0, 120), w, h, alt: img.alt || '' });
        }
      });
      // Also check source elements (picture tags)
      document.querySelectorAll('source').forEach(s => {
        const src = s.srcset || s.getAttribute('data-srcset') || '';
        if (src && src.length > 10) results.push({ src: src.substring(0, 120), w: 0, h: 0, alt: 'source' });
      });
      return results;
    });

    const uniqueImgs = [...new Set(imgs.map(i => i.src))].slice(0, 15);
    console.log('Images:');
    imgs.filter(i => i.w > 100).forEach(i => console.log(`  ${i.w}x${i.h} [${i.alt}] ${i.src}`));
  }

  await browser.close();
}
main().catch(console.error);
