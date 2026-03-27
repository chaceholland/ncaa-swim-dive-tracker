const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://floridagators.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  const data = await page.evaluate(() => {
    const cards = document.querySelectorAll('.s-person-card');
    const results = [];
    for (let i = 0; i < Math.min(3, cards.length); i++) {
      const card = cards[i];
      const html = card.innerHTML.substring(0, 600);
      const name = (card.querySelector('a[href*="/roster/"]') || {}).textContent || '';
      
      // Look for position-like elements
      const spans = card.querySelectorAll('span, div, p');
      const textItems = [];
      for (const span of spans) {
        const t = span.textContent.trim();
        if (t && t.length > 1 && t.length < 50) {
          textItems.push(t);
        }
      }
      
      results.push({ name: name.trim(), html, textItems: [...new Set(textItems)].slice(0, 10) });
    }
    return results;
  });
  
  data.forEach(d => {
    console.log('Name:', d.name);
    console.log('Text items:', d.textItems.join(' | '));
    console.log('HTML snippet:', d.html.substring(0, 300));
    console.log('---');
  });
  
  await browser.close();
})();
