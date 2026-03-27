require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const fs = require('fs');

async function debugBC() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const url = 'https://bceagles.com/sports/mens-swimming-and-diving/roster';

  try {
    console.log(`Loading: ${url}\n`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // Check page title and structure
    const info = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body.textContent.substring(0, 500),

        // Check for various roster-related elements
        hasSidearmRosterPlayer: document.querySelectorAll('.sidearm-roster-player').length,
        hasSidearmRosterContainer: document.querySelectorAll('.sidearm-roster-player-container').length,
        hasRosterLinks: document.querySelectorAll('a[href*="/roster/"]').length,
        hasDataTestPerson: document.querySelectorAll('[data-test-id*="person"]').length,

        // Get sample of all links
        sampleLinks: Array.from(document.querySelectorAll('a'))
          .filter(a => a.textContent.trim().length > 0 && a.textContent.trim().length < 50)
          .slice(0, 20)
          .map(a => ({
            text: a.textContent.trim(),
            href: a.href.substring(0, 80)
          })),

        // Get all class names that include "roster" or "player"
        rosterClasses: Array.from(document.querySelectorAll('[class*="roster"], [class*="player"]'))
          .map(el => el.className)
          .filter((c, i, arr) => arr.indexOf(c) === i)
          .slice(0, 10)
      };
    });

    console.log('=== PAGE INFO ===');
    console.log(`Title: ${info.title}`);
    console.log(`\nBody text preview: ${info.bodyText.replace(/\s+/g, ' ')}`);
    console.log(`\n=== ELEMENT COUNTS ===`);
    console.log(`.sidearm-roster-player: ${info.hasSidearmRosterPlayer}`);
    console.log(`.sidearm-roster-player-container: ${info.hasSidearmRosterContainer}`);
    console.log(`a[href*="/roster/"]: ${info.hasRosterLinks}`);
    console.log(`[data-test-id*="person"]: ${info.hasDataTestPerson}`);

    console.log(`\n=== SAMPLE LINKS ===`);
    info.sampleLinks.forEach(l => {
      console.log(`${l.text} -> ${l.href}`);
    });

    console.log(`\n=== ROSTER/PLAYER CLASSES ===`);
    info.rosterClasses.forEach(c => console.log(c));

    // Save HTML for inspection
    const html = await page.content();
    fs.writeFileSync('/tmp/bc-roster.html', html);
    console.log(`\nSaved HTML to: /tmp/bc-roster.html`);

    await browser.close();
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await browser.close();
  }
}

debugBC();
