const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // SIDEARM v1 KO API endpoints
  const apiUrls = [
    'https://unlvrebels.com/services/responsive/roster.ashx?type=roster&sport=mswim&roster=',
    'https://unlvrebels.com/services/get_roster_html.ashx?sport_id=9',
    'https://unlvrebels.com/services/roster_data.ashx?sport_id=9',
    'https://unlvrebels.com/api/v2/players?sport=mswim',
    'https://unlvrebels.com/api/v2/sports/mswim/players',
  ];
  for (const url of apiUrls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const body = await page.evaluate(() => document.body.innerText.substring(0, 300));
    console.log('\n---', url.substring(50));
    console.log(body.substring(0, 200));
  }

  // Also check UNLV's Sidearm version by inspecting the main roster page scripts
  await page.goto('https://unlvrebels.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.src)
      .filter(s => s.includes('sidearm') || s.includes('roster'));
  });
  console.log('\nScript tags:', scripts.join('\n'));

  await browser.close();
})().catch(e => console.error('Error:', e.message));
