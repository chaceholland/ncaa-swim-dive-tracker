const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  
  // First visit the sports list to get the right URL
  await page.goto('https://ohiostatebuckeyes.com/sports', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Find swim link
  const swimLink = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="swim"]');
    return Array.from(links).map(l => ({ text: l.textContent.trim(), href: l.href })).slice(0, 10);
  });
  
  console.log('Swim links:', JSON.stringify(swimLink));
  
  // Try navigating directly to m-swim
  await page.goto('https://ohiostatebuckeyes.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.goto('https://ohiostatebuckeyes.com/sports/m-swim/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const finalUrl = page.url();
  const title = await page.title();
  const cards = await page.locator('.s-person-card').count();
  const tables = await page.locator('.s-table').count();
  
  console.log('Ohio State final URL:', finalUrl, 'title:', title.substring(0, 60));
  console.log('Cards:', cards, 'Tables:', tables);
  
  await browser.close();
})();
