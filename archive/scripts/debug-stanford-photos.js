require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Delete "Roster for Basketball" athlete first
  console.log('Checking for bad Stanford athlete...');

  // Debug a Stanford athlete's profile page
  const profiles = [
    'https://gostanford.com/sports/mens-swimming-and-diving/roster/henry-mcfadden',
    'https://gostanford.com/sports/mens-swimming-and-diving/roster/daniel-li',
  ];

  for (const url of profiles) {
    console.log('\n=== ' + url + ' ===');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log('Title:', title);

    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src?.substring(0, 120),
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
      })).filter(i => i.w > 50 || i.h > 50);
    });
    images.forEach(i => console.log(`  ${i.w}x${i.h} ${i.src}`));
  }

  await browser.close();
}
main().catch(console.error);
