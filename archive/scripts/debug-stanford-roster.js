require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://gostanford.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Print all unique athlete profile links
  const links = await page.evaluate(() => {
    const seen = new Set();
    const results = [];
    document.querySelectorAll('a[href*="/roster/"]').forEach(a => {
      const href = a.href;
      if (!href || href.includes('#') || seen.has(href)) return;
      if (href.includes('mens-basketball')) return; // skip cross-links
      seen.add(href);
      const text = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      const rosterPart = href.split('/roster/')[1] || href;
      results.push({ text, part: rosterPart, href });
    });
    return results.filter(r => !r.part.includes('mens-basketball'));
  });

  console.log('Stanford roster links:');
  links.forEach(l => console.log(`  [${l.text}] -> ${l.part}`));

  // Now visit Henry McFadden's correct profile (whichever link matches)
  const mcfadden = links.find(l => l.text.toLowerCase().includes('mcfadden') || l.part.includes('mcfadden'));
  if (mcfadden) {
    console.log('\n=== McFadden profile ===');
    await page.goto(mcfadden.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const imgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src?.substring(0, 120),
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
      })).filter(i => i.w > 100 && i.h > 100);
    });
    imgs.forEach(i => console.log(`  ${i.w}x${i.h} ${i.src}`));
  } else {
    console.log('\nMcFadden not found in links');
  }

  await browser.close();
}
main().catch(console.error);
