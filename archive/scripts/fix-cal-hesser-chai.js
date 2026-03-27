require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TARGETS = [
  { name: 'Trey  Hesser', profileUrl: 'https://calbears.com/sports/mens-swimming-and-diving/roster/trey-hesser/27013' },
  { name: 'Matthew Chai', profileUrl: 'https://calbears.com/sports/mens-swimming-and-diving/roster/matthew-chai/27008' },
];

async function main() {
  const { data: team } = await supabase.from('teams').select('id, logo_url').eq('name', 'Cal').single();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const t of TARGETS) {
    const { data: a } = await supabase.from('athletes').select('id').eq('team_id', team.id).eq('name', t.name).single();
    if (!a) { console.log('Not found: ' + t.name); continue; }

    await page.goto(t.profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const photoUrl = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter(img => {
          const src = img.src || '';
          if (!src.includes('calbears.com/images/')) return false;
          if (src.includes('logo') || src.includes('.svg') || src.includes('sponsor')) return false;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w < 80 || h < 80) return false;
          return true;
        })
        .map(img => ({
          src: img.src,
          area: (img.naturalWidth || img.width) * (img.naturalHeight || img.height)
        }))
        .sort((a, b) => b.area - a.area)[0]?.src || null;
    });

    const finalPhoto = photoUrl || team.logo_url;
    await supabase.from('athletes').update({ photo_url: finalPhoto, profile_url: t.profileUrl }).eq('id', a.id);
    console.log(t.name + ': ' + (photoUrl ? '✅ ' + photoUrl.substring(0, 70) : '❌ no photo (logo)'));
  }

  // Set Aaron Shackell to Indiana logo (no real headshot on their site)
  const { data: iuTeam } = await supabase.from('teams').select('id, logo_url').eq('name', 'Indiana').single();
  const { data: shackell } = await supabase.from('athletes').select('id, photo_url')
    .eq('team_id', iuTeam.id).eq('name', 'Aaron Shackell').single();
  if (shackell) {
    await supabase.from('athletes').update({ photo_url: iuTeam.logo_url }).eq('id', shackell.id);
    console.log('Aaron Shackell (Indiana): set to team logo (no headshot on IU site)');
  }

  await browser.close();
}
main().catch(console.error);
