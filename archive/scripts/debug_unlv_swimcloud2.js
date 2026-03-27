// Try swimcloud search for UNLV
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://www.swimcloud.com/team/?q=unlv', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => ({
    title: document.title.substring(0, 80),
    body: document.body.innerText.substring(0, 800).replace(/\n/g, ' | '),
  }));
  console.log('Title:', info.title);
  console.log('Body:', info.body);
  await browser.close();
})().catch(e => console.error('Error:', e.message));
