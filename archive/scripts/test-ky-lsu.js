const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Try Kentucky with longer wait
  await page.goto('https://ukathletics.com/sports/mswim/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);
  
  const kyResult = await page.evaluate(() => {
    const tables = document.querySelectorAll('.s-table');
    const cards = document.querySelectorAll('.s-person-card');
    const sidearm = document.querySelectorAll('.sidearm-roster-player');
    const bodyLen = document.body.textContent.length;
    
    // Look for athlete names via any link in roster area
    const rosterLinks = document.querySelectorAll('a[href*="/roster/"], a[href*="mens-swimming"]');
    const linkTexts = Array.from(rosterLinks).map(l => l.textContent.trim()).filter(t => t.length > 2).slice(0, 5);
    
    // Check if there's an inline JSON data blob
    const scripts = document.querySelectorAll('script');
    let hasRosterData = false;
    for (const s of scripts) {
      if (s.textContent && s.textContent.includes('roster') && s.textContent.includes('first_name')) {
        hasRosterData = true;
        break;
      }
    }
    
    return { tables: tables.length, cards: cards.length, sidearm: sidearm.length, bodyLen, linkTexts, hasRosterData };
  });
  
  console.log('Kentucky:', JSON.stringify(kyResult));
  
  // Wait for more JS
  await page.waitForTimeout(5000);
  const kyResult2 = await page.evaluate(() => {
    const tables = document.querySelectorAll('.s-table');
    const cards = document.querySelectorAll('.s-person-card');
    return { tables: tables.length, cards: cards.length };
  });
  console.log('Kentucky (after extra wait):', JSON.stringify(kyResult2));
  
  await browser.close();
})();
