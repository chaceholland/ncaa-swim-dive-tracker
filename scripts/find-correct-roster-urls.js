const { chromium } = require('playwright');

const teams = [
  { name: 'Auburn', baseUrl: 'https://auburntigers.com' },
  { name: 'Kentucky', baseUrl: 'https://ukathletics.com' },
  { name: 'LSU', baseUrl: 'https://lsusports.net' },
  { name: 'Missouri', baseUrl: 'https://mutigers.com' },
  { name: 'South Carolina', baseUrl: 'https://gamecocksonline.com' },
];

async function findRosterUrl(page, team) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Finding roster URL for: ${team.name}`);
  console.log('='.repeat(70));

  try {
    await page.goto(team.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Search for swimming/diving links
    const links = await page.evaluate(() => {
      const allLinks = document.querySelectorAll('a');
      const swimmingLinks = [];

      allLinks.forEach(link => {
        const text = link.textContent.toLowerCase();
        const href = link.href;

        if ((text.includes('swim') || href.includes('swim')) &&
            !text.includes('women') &&
            !href.includes('women')) {
          swimmingLinks.push({
            text: link.textContent.trim(),
            href: link.href
          });
        }
      });

      // Remove duplicates
      const unique = [];
      const seen = new Set();
      swimmingLinks.forEach(l => {
        if (!seen.has(l.href)) {
          seen.add(l.href);
          unique.push(l);
        }
      });

      return unique;
    });

    console.log(`Found ${links.length} swimming-related links:`);
    links.forEach(link => {
      console.log(`  "${link.text}" -> ${link.href}`);
    });

    // Try to navigate to the most likely roster page
    const rosterLink = links.find(l =>
      l.href.includes('/roster') ||
      l.text.toLowerCase().includes('roster')
    );

    if (rosterLink) {
      console.log(`\nTrying roster link: ${rosterLink.href}`);
      const response = await page.goto(rosterLink.href, { waitUntil: 'domcontentloaded', timeout: 15000 });

      if (response.status() === 200 && !page.url().includes('404')) {
        console.log(`✅ Found valid roster URL: ${page.url()}`);
        return page.url();
      }
    }

    // If no direct roster link, try swimming page first
    const swimmingPage = links.find(l =>
      l.href.includes('/sports/') &&
      (l.href.includes('swim') || l.href.includes('msd'))
    );

    if (swimmingPage) {
      console.log(`\nTrying swimming page: ${swimmingPage.href}`);
      await page.goto(swimmingPage.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Look for roster link on swimming page
      const rosterOnPage = await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.textContent.toLowerCase().includes('roster') ||
              link.href.includes('/roster')) {
            return link.href;
          }
        }
        return null;
      });

      if (rosterOnPage) {
        console.log(`✅ Found roster URL: ${rosterOnPage}`);
        return rosterOnPage;
      }
    }

    console.log('⚠️  Could not find roster URL');
    return null;

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('\n🔍 FINDING CORRECT ROSTER URLs\n');

  const results = {};
  for (const team of teams) {
    const rosterUrl = await findRosterUrl(page, team);
    results[team.name] = rosterUrl;
  }

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  Object.entries(results).forEach(([team, url]) => {
    console.log(`${team}: ${url || 'NOT FOUND'}`);
  });
}

main();
