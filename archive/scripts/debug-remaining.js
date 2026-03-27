require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Debug Caleb Liban's ASU profile
  console.log('\n=== Caleb Liban (ASU profile) ===');
  await page.goto('https://thesundevils.com/sports/mens-swimming-and-diving/roster/player/caleb-liban', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const libanImages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src?.substring(0, 100),
      w: img.naturalWidth || img.width,
      h: img.naturalHeight || img.height
    })).filter(i => i.w > 50 && i.h > 50);
  });
  libanImages.forEach(i => console.log(`  ${i.w}x${i.h} ${i.src}`));

  // Try different Stanford URL
  console.log('\n=== Stanford URLs ===');
  const stanfordUrls = [
    'https://gostanford.com/sports/mens-swimming-and-diving/roster',
    'https://gostanford.com/sports/swimming/roster',
    'https://gostanford.com/sports/mens-swimming/roster',
  ];
  for (const url of stanfordUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000);
      const title = await page.title();
      const count = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/roster/"]').length;
      });
      console.log(`  ${url} -> "${title}" (${count} roster links)`);
    } catch (e) {
      console.log(`  ${url} -> ERROR: ${e.message.slice(0, 50)}`);
    }
  }

  // Try different Ohio State URLs
  console.log('\n=== Ohio State URLs ===');
  const osuUrls = [
    'https://ohiostatebuckeyes.com/sports/mens-swimming-and-diving/roster',
    'https://ohiostatebuckeyes.com/sports/swimming-and-diving/roster',
    'https://ohiostatebuckeyes.com/sports/c-swim/roster',
  ];
  for (const url of osuUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000);
      const title = await page.title();
      const count = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/roster/"]').length;
      });
      console.log(`  ${url} -> "${title}" (${count} roster links)`);
    } catch (e) {
      console.log(`  ${url} -> ERROR: ${e.message.slice(0, 50)}`);
    }
  }

  // Try different Cal URLs
  console.log('\n=== Cal URLs ===');
  const calUrls = [
    'https://calbears.com/sports/mens-swimming-and-diving/roster',
    'https://calbears.com/sports/swimming/roster',
    'https://calbears.com/sports/mens-swimming/roster',
  ];
  for (const url of calUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000);
      const title = await page.title();
      const count = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/roster/"]').length;
      });
      console.log(`  ${url} -> "${title}" (${count} roster links)`);
    } catch (e) {
      console.log(`  ${url} -> ERROR: ${e.message.slice(0, 50)}`);
    }
  }

  await browser.close();
}
main().catch(console.error);
