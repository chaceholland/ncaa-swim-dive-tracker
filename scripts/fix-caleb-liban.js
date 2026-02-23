require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://thesundevils.com/sports/mens-swimming-and-diving/roster/player/caleb-liban', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Get the best portrait photo
  const photoUrl = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img'))
      .filter(img => {
        const src = img.src || '';
        if (!src.includes('googleapis.com')) return false;
        if (src.toLowerCase().includes('logo') || src.includes('.svg')) return false;
        return true;
      })
      .map(img => ({
        src: img.src,
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
      }))
      .filter(i => i.w > 0 && i.h > 0)
      .sort((a, b) => (b.w * b.h) - (a.w * a.h))[0]?.src || null;
  });

  await browser.close();

  if (!photoUrl) { console.log('No photo found'); return; }

  const { data: t } = await supabase.from('teams').select('id').eq('name', 'Arizona State').single();
  await supabase.from('athletes').update({
    photo_url: photoUrl,
    profile_url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster/player/caleb-liban'
  }).eq('team_id', t.id).eq('name', 'Caleb Liban');
  console.log('Caleb Liban: ✅ ' + photoUrl.substring(0, 80));
}
main().catch(console.error);
