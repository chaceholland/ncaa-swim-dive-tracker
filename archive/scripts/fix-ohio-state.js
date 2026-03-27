require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const { data: team } = await supabase.from('teams').select('id, logo_url').eq('name', 'Ohio State').single();

  // Try possible profile URL patterns for Butler and Hemingway
  const candidates = [
    { name: 'Michael Butler', slugs: ['michael-butler', 'mike-butler'] },
    { name: 'Patrick Hemingway', slugs: ['patrick-hemingway'] },
  ];

  const baseUrls = [
    'https://ohiostatebuckeyes.com/sports/c-swim/roster/',
    'https://ohiostatebuckeyes.com/sports/mens-swimming-and-diving/roster/',
    'https://ohiostatebuckeyes.com/sports/swimming-and-diving/roster/',
  ];

  for (const candidate of candidates) {
    const { data: a } = await supabase.from('athletes').select('id').eq('team_id', team.id).eq('name', candidate.name).single();
    if (!a) { console.log('Not found: ' + candidate.name); continue; }

    let found = false;
    for (const base of baseUrls) {
      for (const slug of candidate.slugs) {
        const url = base + slug;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(1000);
          const title = await page.title();
          if (!title.toLowerCase().includes('not found') && !title.toLowerCase().includes('404') && !title.toLowerCase().includes('error')) {
            console.log(candidate.name + ': Found at ' + url + ' -> "' + title + '"');

            // Try to get photo
            const imgs = await page.evaluate(() => {
              return Array.from(document.querySelectorAll('img'))
                .filter(img => {
                  const src = img.src || '';
                  if (!src.includes('ohiostatebuckeyes') && !src.includes('cloudfront') && !src.includes('supabase')) return false;
                  const w = img.naturalWidth || img.width || 0;
                  const h = img.naturalHeight || img.height || 0;
                  return w > 80 && h > 80 && (w / h) >= 0.4 && (w / h) <= 1.1;
                })
                .map(img => ({ src: img.src, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }))
                .sort((a, b) => (b.w * b.h) - (a.w * a.h));
            });
            console.log('  Images:', imgs.map(i => i.w + 'x' + i.h + ' ' + i.src.substring(0, 80)));
            found = true;
            break;
          }
        } catch { /* skip */ }
      }
      if (found) break;
    }
    if (!found) {
      console.log(candidate.name + ': No profile found, setting to team logo');
      await supabase.from('athletes').update({ photo_url: team.logo_url }).eq('id', a.id);
    }
  }

  // Also try Paul Mathews and Peter Edin - they're probably not on Alabama's current roster
  // Let's just set them to Alabama logo for now
  console.log('\nChecking Alabama athletes not on current roster...');
  const { data: alabamaTeam } = await supabase.from('teams').select('id, logo_url').eq('name', 'Alabama').single();
  for (const name of ['Paul Mathews', 'Peter Edin']) {
    const { data: a } = await supabase.from('athletes').select('id, photo_url').eq('team_id', alabamaTeam.id).eq('name', name).single();
    if (!a) { console.log(name + ': Not found in DB'); continue; }
    await supabase.from('athletes').update({ photo_url: alabamaTeam.logo_url, profile_url: null }).eq('id', a.id);
    console.log(name + ' (Alabama): set to team logo (not on current roster)');
  }

  await browser.close();
}
main().catch(console.error);
