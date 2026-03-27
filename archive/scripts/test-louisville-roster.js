require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function testRosterPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const rosterUrl = 'https://gocards.com/sports/mens-swimming-and-diving/roster';

  console.log(`Loading: ${rosterUrl}\n`);

  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // Check for athlete cards with photos
    const athleteData = await page.evaluate(() => {
      const athletes = [];

      // Find all athlete elements
      const selectors = [
        '.sidearm-roster-player',
        '.sidearm-roster-player-container',
        '[class*="roster"] [class*="player"]',
        '.roster-card',
        'li.sidearm-roster-player'
      ];

      let athleteElements = [];
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          athleteElements = elements;
          console.log(`Found ${elements.length} athletes with selector: ${selector}`);
          break;
        }
      }

      athleteElements.slice(0, 3).forEach(el => {
        // Get name
        const nameEl = el.querySelector('.sidearm-roster-player-name') ||
                       el.querySelector('[class*="name"]') ||
                       el.querySelector('h3') ||
                       el.querySelector('a');

        const name = nameEl ? nameEl.textContent.trim() : 'Unknown';

        // Get photo
        const imgEl = el.querySelector('img');
        const photoSrc = imgEl ? imgEl.src : null;

        athletes.push({ name, photoSrc });
      });

      return athletes;
    });

    console.log('=== FIRST 3 ATHLETES ON ROSTER ===\n');
    athleteData.forEach((athlete, i) => {
      console.log(`[${i + 1}] ${athlete.name}`);
      console.log(`    Photo: ${athlete.photoSrc || 'NONE'}\n`);
    });

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

testRosterPage();
