const { chromium } = require('playwright');

const teams = [
  { name: 'Auburn', url: 'https://auburntigers.com/sports/mens-swimming-diving/roster' },
  { name: 'Kentucky', url: 'https://ukathletics.com/sports/mens-swimming-and-diving/roster' },
  { name: 'LSU', url: 'https://lsusports.net/sports/mens-swimming-and-diving/roster' },
  { name: 'Missouri', url: 'https://mutigers.com/sports/mens-swimming-and-diving/roster' },
  { name: 'South Carolina', url: 'https://gamecocksonline.com/sports/mens-swimming-and-diving/roster' },
];

async function diagnoseTeam(page, team) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Diagnosing: ${team.name}`);
  console.log(`URL: ${team.url}`);
  console.log('='.repeat(70));

  try {
    const response = await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const status = response.status();
    const finalUrl = page.url();

    console.log(`Status: ${status}`);
    console.log(`Final URL: ${finalUrl}`);
    console.log(`Redirected: ${finalUrl !== team.url ? 'YES' : 'NO'}`);

    if (status === 404) {
      console.log('❌ Page not found (404)');
      return;
    }

    // Check page title
    const title = await page.title();
    console.log(`Page Title: ${title}`);

    // Count roster links
    const linkInfo = await page.evaluate(() => {
      const allLinks = document.querySelectorAll('a[href*="/roster/"]');
      const totalLinks = allLinks.length;

      // Sample first 5 links
      const samples = Array.from(allLinks).slice(0, 5).map(link => ({
        text: link.textContent.trim().substring(0, 30),
        href: link.href.substring(link.href.indexOf('/roster/'))
      }));

      return { totalLinks, samples };
    });

    console.log(`\nTotal roster links: ${linkInfo.totalLinks}`);
    if (linkInfo.samples.length > 0) {
      console.log('Sample links:');
      linkInfo.samples.forEach(s => {
        console.log(`  "${s.text}" -> ${s.href}`);
      });
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('\n🔍 DIAGNOSING REMAINING TEAMS\n');

  for (const team of teams) {
    await diagnoseTeam(page, team);
  }

  await browser.close();
  console.log('\n✅ Diagnosis complete\n');
}

main();
