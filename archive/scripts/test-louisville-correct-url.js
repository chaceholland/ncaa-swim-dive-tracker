require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function testCorrectURL() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Test the correct URL pattern from database
  const correctRosterUrl = 'https://gocards.com/sports/swimming-and-diving/roster';

  console.log(`Testing: ${correctRosterUrl}\n`);

  try {
    await page.goto(correctRosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    // Scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // First check if page is valid
    const title = await page.title();
    console.log(`Page title: ${title}\n`);

    // Check for athletes and photos
    const athleteData = await page.evaluate(() => {
      const athletes = [];

      // Try different selectors
      const selectors = [
        '.sidearm-roster-player',
        '.sidearm-roster-player-container',
        '[class*="roster-card"]',
        'li.sidearm-roster-player'
      ];

      let athleteElements = [];
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          athleteElements = elements;
          console.log(`Found ${elements.length} with: ${selector}`);
          break;
        }
      }

      athleteElements.slice(0, 5).forEach(el => {
        // Get name
        const nameEl = el.querySelector('.sidearm-roster-player-name') ||
                       el.querySelector('[class*="name"]') ||
                       el.querySelector('h3') ||
                       el.querySelector('a');

        const name = nameEl ? nameEl.textContent.trim() : null;

        // Get photo
        const img = el.querySelector('img');
        const photoSrc = img ? img.src : null;

        // Get profile URL
        const link = el.querySelector('a[href*="/roster/"]');
        const profileUrl = link ? link.href : null;

        if (name) {
          athletes.push({ name, photoSrc, profileUrl });
        }
      });

      return athletes;
    });

    console.log('=== FIRST 5 ATHLETES ===\n');
    athleteData.forEach((athlete, i) => {
      console.log(`[${i + 1}] ${athlete.name}`);
      console.log(`    Photo: ${athlete.photoSrc || 'NONE'}`);
      console.log(`    Profile: ${athlete.profileUrl || 'NONE'}\n`);
    });

    await browser.close();
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await browser.close();
  }
}

testCorrectURL();
