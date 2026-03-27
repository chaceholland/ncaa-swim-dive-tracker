require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function debugRosterPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const rosterUrl = 'https://gocards.com/sports/mens-swimming-and-diving/roster';

  console.log(`Loading: ${rosterUrl}\n`);

  try {
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    // Scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // Check page structure
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        hasRosterClass: !!document.querySelector('[class*="roster"]'),
        hasPlayerClass: !!document.querySelector('[class*="player"]'),
        hasSidearmClass: !!document.querySelector('[class*="sidearm"]'),

        // Count different elements
        divCount: document.querySelectorAll('div').length,
        imgCount: document.querySelectorAll('img').length,

        // Sample class names from page
        sampleClasses: Array.from(document.querySelectorAll('[class]'))
          .slice(0, 50)
          .map(el => el.className)
          .filter((c, i, arr) => arr.indexOf(c) === i) // unique
          .slice(0, 20),

        // Look for any athlete-like content
        possibleAthletes: Array.from(document.querySelectorAll('a[href*="/roster/"]')).slice(0, 3).map(a => ({
          href: a.href,
          text: a.textContent.trim().substring(0, 50)
        }))
      };
    });

    console.log('=== PAGE INFO ===');
    console.log(`Title: ${pageInfo.title}`);
    console.log(`Has roster class: ${pageInfo.hasRosterClass}`);
    console.log(`Has player class: ${pageInfo.hasPlayerClass}`);
    console.log(`Has sidearm class: ${pageInfo.hasSidearmClass}`);
    console.log(`Div count: ${pageInfo.divCount}`);
    console.log(`Image count: ${pageInfo.imgCount}`);

    console.log('\n=== SAMPLE CLASSES ===');
    pageInfo.sampleClasses.forEach(c => console.log(`  ${c}`));

    console.log('\n=== POSSIBLE ATHLETE LINKS ===');
    pageInfo.possibleAthletes.forEach(a => {
      console.log(`  ${a.text}`);
      console.log(`  ${a.href}\n`);
    });

    await browser.close();
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await browser.close();
  }
}

debugRosterPage();
