// The UNLV website shows 2021-22 roster. Let's check if there's a newer URL or API
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Check if UNLV has a newer roster URL 
  const urls = [
    'https://unlvrebels.com/sports/mens-swimming-and-diving/roster?season=2025-26',
    'https://unlvrebels.com/sports/mens-swimming-and-diving/roster/2025-26',
    'https://unlvrebels.com/sports/swim-dive/roster',
    'https://unlvrebels.com/sports/swim/roster',
  ];

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch(e) {}
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => ({
      title: document.title.substring(0, 80),
      url: window.location.href.substring(0, 100),
    }));
    console.log(url, '->', info.title);
  }

  // Also check Sidearm services API for UNLV to see if there's newer roster data
  const sidearmUrl = 'https://unlvrebels.com/services/responsive/roster.ashx?type=roster&sport=mswim&season=&roster=';
  await page.goto(sidearmUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const body = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('\nSidearm API response:', body.substring(0, 300));

  await browser.close();
})().catch(e => console.error('Error:', e.message));
