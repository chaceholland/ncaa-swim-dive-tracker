require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function debugNotreDame() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const url = 'https://fightingirish.com/sports/mens-swimming-and-diving/roster';

  try {
    console.log(`Loading: ${url}\n`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    const title = await page.title();
    console.log(`Title: ${title}\n`);

    const info = await page.evaluate(() => {
      // Try all possible selectors
      const results = {};

      const testSelectors = [
        '.sidearm-roster-player',
        '.sidearm-roster-player-container',
        '[class*="roster"][class*="player"]',
        '.roster-card',
        'li.sidearm-roster-player',
        '[data-test-id*="person"]',
        'a[href*="/roster/"]'
      ];

      testSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        results[selector] = elements.length;
      });

      // Get sample athlete data if links exist
      const links = Array.from(document.querySelectorAll('a[href*="/roster/"]')).slice(0, 5);
      const sampleAthletes = links.map(a => ({
        href: a.href,
        text: a.textContent.trim().substring(0, 50),
        classes: a.className
      }));

      return { counts: results, samples: sampleAthletes };
    });

    console.log('=== SELECTOR COUNTS ===');
    Object.entries(info.counts).forEach(([selector, count]) => {
      console.log(`${selector}: ${count}`);
    });

    console.log('\n=== SAMPLE ATHLETES ===');
    info.samples.forEach((s, i) => {
      console.log(`\n[${i + 1}]`);
      console.log(`  Text: ${s.text}`);
      console.log(`  Classes: ${s.classes || 'none'}`);
      console.log(`  Href: ${s.href}`);
    });

    await browser.close();
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await browser.close();
  }
}

debugNotreDame();
