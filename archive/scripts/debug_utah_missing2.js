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
    const cards = document.querySelectorAll('.s-person-card');
    const found = [];
    cards.forEach(card => {
      const nameEl = card.querySelector('.s-person-details__personal-single-line, [class*="personal-single"]');
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      if (name.toLowerCase().includes('lewis') || name.toLowerCase().includes('king')) {
        // Get all text content with structure
        const allText = card.innerText;
        // Look for any bio stats element - maybe different selector
        const allDataTests = Array.from(card.querySelectorAll('[data-test-id]')).map(el => ({
          id: el.getAttribute('data-test-id'),
          text: el.textContent.trim().substring(0, 50),
        }));
        // Get sport-person-title or coach role
        const roleEls = Array.from(card.querySelectorAll('[class*="title"], [class*="role"], [class*="position"]')).map(el => el.textContent.trim());
        found.push({ name, allText: allText.substring(0, 200), allDataTests, roleEls });
      }
    });
    return found;
  });
  
  result.forEach(r => {
    console.log('\nName:', r.name);
    console.log('allText:', r.allText.replace(/\n/g, ' | '));
    console.log('dataTests:', JSON.stringify(r.allDataTests));
    console.log('roleEls:', JSON.stringify(r.roleEls));
  });
  
  await browser.close();
})().catch(e => console.error('Error:', e.message));
