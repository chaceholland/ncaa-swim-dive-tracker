require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Navigating to LSU roster page...');

  await page.goto('https://lsusports.net/sports/mens-swimming-diving/roster', {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });

  await page.waitForTimeout(5000);

  console.log('\nPage title:', await page.title());

  const html = await page.content();
  console.log('\nPage length:', html.length);

  // Check for various selectors
  const selectors = [
    '.s-person-card',
    '.roster-player',
    '.sidearm-roster-player',
    'a[href*="/roster/"]',
    'a[href*="/player/"]',
    '.athlete',
    '.player',
  ];

  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    console.log(`${selector}: ${count} elements`);
  }

  // Take a screenshot
  await page.screenshot({ path: 'lsu-roster-debug.png', fullPage: true });
  console.log('\nScreenshot saved to lsu-roster-debug.png');

  await browser.close();
}

main();
