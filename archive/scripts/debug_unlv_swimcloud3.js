const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Find UNLV on swimcloud by searching page
  await page.goto('https://www.swimcloud.com/team/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/team/"]'))
      .map(a => ({ text: a.textContent.trim(), href: a.href }))
      .filter(a => a.text.toLowerCase().includes('nevada') || a.text.toLowerCase().includes('unlv') || a.text.toLowerCase().includes('las vegas'));
  });
  console.log('UNLV links on swimcloud:', JSON.stringify(links));
  await browser.close();
})().catch(e => console.error('Error:', e.message));
