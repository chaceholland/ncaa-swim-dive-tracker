require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const fs = require('fs');

async function inspectHTML() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const url = 'https://gocards.com/sports/swimming-and-diving/roster';

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // Get the full HTML
    const html = await page.content();

    // Save to file for inspection
    fs.writeFileSync('/tmp/louisville-roster.html', html);
    console.log('Saved HTML to: /tmp/louisville-roster.html');

    // Also check for specific patterns
    const patterns = await page.evaluate(() => {
      return {
        hasRosterElements: document.querySelectorAll('[class*="roster"]').length,
        hasPlayerElements: document.querySelectorAll('[class*="player"]').length,
        hasAthleteElements: document.querySelectorAll('[class*="athlete"]').length,
        hasCardElements: document.querySelectorAll('[class*="card"]').length,
        totalImages: document.querySelectorAll('img').length,
        linksToRoster: document.querySelectorAll('a[href*="/roster/"]').length,

        // Sample of roster link hrefs
        sampleLinks: Array.from(document.querySelectorAll('a[href*="/roster/"]'))
          .slice(0, 5)
          .map(a => ({ href: a.href, text: a.textContent.trim().substring(0, 30) }))
      };
    });

    console.log('\n=== PATTERN COUNTS ===');
    console.log(JSON.stringify(patterns, null, 2));

    await browser.close();
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await browser.close();
  }
}

inspectHTML();
