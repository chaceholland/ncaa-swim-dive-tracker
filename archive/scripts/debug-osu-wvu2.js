const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  
  // Ohio State
  await page.goto('https://ohiostatebuckeyes.com/sports/mens-swim-dive/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  let info = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title.substring(0, 60),
    cards: document.querySelectorAll('.s-person-card').length,
    tables: document.querySelectorAll('.s-table').length,
    rosterGroups: document.querySelectorAll('.roster-players__group').length,
    rosterItems: document.querySelectorAll('.roster-list-item').length,
    bodyLen: document.body.textContent.length
  }));
  console.log('Ohio State:', JSON.stringify(info));
  
  // Find swim link on WVU
  await page.goto('https://wvusports.com/sports', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const wvuSwimLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="swim"]');
    return Array.from(links).map(l => ({ text: l.textContent.trim(), href: l.href })).slice(0, 5);
  });
  console.log('WVU Swim links:', JSON.stringify(wvuSwimLinks));
  
  await browser.close();
})();
