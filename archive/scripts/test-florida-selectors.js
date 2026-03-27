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
      
      // Try specific selectors for name
      const nameEl1 = card.querySelector('[data-test-id="s-person-details__name-link"]');
      const nameEl2 = card.querySelector('.s-person-details__personal-name');
      const nameEl3 = card.querySelector('h3');
      const nameEl4 = card.querySelector('[class*="personal-single-line"]');
      
      // Try position selectors
      const posEl1 = card.querySelector('[class*="bio-stats-item"]');
      const posEl2 = card.querySelector('[data-label="Position"]');
      
      // All bio-stat items
      const bioStats = card.querySelectorAll('[class*="bio-stats-item"]');
      
      results.push({
        nameEl1: nameEl1 ? nameEl1.textContent.trim() : null,
        nameEl2: nameEl2 ? nameEl2.textContent.trim() : null,
        nameEl3: nameEl3 ? nameEl3.textContent.trim() : null,
        nameEl4: nameEl4 ? nameEl4.textContent.trim() : null,
        posEl1: posEl1 ? posEl1.textContent.trim() : null,
        bioStats: Array.from(bioStats).map(el => el.textContent.trim()).slice(0, 5),
      });
    }
    return results;
  });
  
  data.forEach(d => console.log(JSON.stringify(d, null, 2)));
  
  await browser.close();
})();
