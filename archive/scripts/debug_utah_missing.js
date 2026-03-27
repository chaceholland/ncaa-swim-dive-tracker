// Check if Brody Lewis and McKay King are actually student athletes on Utah's site
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://utahutes.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(15000);
  
  const result = await page.evaluate(() => {
    // Find cards for Brody Lewis and McKay King
    const cards = document.querySelectorAll('.s-person-card');
    const found = [];
    cards.forEach(card => {
      const nameEl = card.querySelector('.s-person-details__personal-single-line, [class*="personal-single"]');
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      if (name.toLowerCase().includes('lewis') || name.toLowerCase().includes('king')) {
        found.push({
          name,
          html: card.outerHTML.substring(0, 600),
        });
      }
    });
    return found;
  });
  
  console.log('Found matching cards:', result.length);
  result.forEach(r => {
    console.log('\nName:', r.name);
    console.log('HTML:', r.html.substring(0, 400));
  });
  
  await browser.close();
})().catch(e => console.error('Error:', e.message));
