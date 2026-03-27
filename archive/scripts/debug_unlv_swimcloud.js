// Try swimcloud for UNLV class year data
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Swimcloud UNLV team
  const urls = [
    'https://www.swimcloud.com/team/unlv/',
    'https://www.swimcloud.com/team/327/',  
  ];
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      const info = await page.evaluate(() => ({
        title: document.title.substring(0, 80),
        url: window.location.href.substring(0, 100),
        body: document.body.innerText.substring(0, 300).replace(/\n/g, ' | '),
      }));
      console.log(url, '->', info.title, '|', info.url);
    } catch(e) {
      console.log(url, 'ERROR:', e.message.substring(0, 60));
    }
  }
  await browser.close();
})().catch(e => console.error('Error:', e.message));
