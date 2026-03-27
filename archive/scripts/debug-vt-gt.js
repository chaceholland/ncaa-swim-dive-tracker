require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function debugSchool(name, url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DEBUGGING: ${name}`);
  console.log('='.repeat(60));
  console.log(`URL: ${url}\n`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      return {
        title: document.title,

        // Check all possible selectors
        sidearmRosterPlayer: document.querySelectorAll('.sidearm-roster-player').length,
        dataTestPerson: document.querySelectorAll('[data-test-id*="person"]').length,
        rosterLinks: document.querySelectorAll('a[href*="/roster/"]').length,
        playerLinks: document.querySelectorAll('a[href*="/player/"]').length,

        // Get sample roster/athlete related links
        sampleRosterLinks: Array.from(document.querySelectorAll('a[href*="/roster/"], a[href*="/player/"]'))
          .slice(0, 5)
          .map(a => ({
            text: a.textContent.trim().substring(0, 40),
            href: a.href
          })),

        // Check for table rows (some sites use tables)
        tableRows: document.querySelectorAll('table tr').length,

        // Get all unique class names containing roster, player, or athlete
        relevantClasses: Array.from(new Set(
          Array.from(document.querySelectorAll('[class*="roster"], [class*="player"], [class*="athlete"]'))
            .map(el => el.className)
        )).slice(0, 10)
      };
    });

    console.log(`Title: ${info.title}`);
    console.log(`\nElement counts:`);
    console.log(`  .sidearm-roster-player: ${info.sidearmRosterPlayer}`);
    console.log(`  [data-test-id*="person"]: ${info.dataTestPerson}`);
    console.log(`  a[href*="/roster/"]: ${info.rosterLinks}`);
    console.log(`  a[href*="/player/"]: ${info.playerLinks}`);
    console.log(`  table rows: ${info.tableRows}`);

    console.log(`\nSample links:`);
    info.sampleRosterLinks.forEach((l, i) => {
      console.log(`  [${i + 1}] ${l.text}`);
      console.log(`      ${l.href}`);
    });

    console.log(`\nRelevant classes:`);
    info.relevantClasses.forEach(c => console.log(`  ${c}`));

    await browser.close();
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await browser.close();
  }
}

async function main() {
  await debugSchool('Virginia Tech', 'https://hokiesports.com/sports/swimming-diving/roster');
  await debugSchool('Georgia Tech', 'https://ramblinwreck.com/sports/c-swim/roster');
}

main();
