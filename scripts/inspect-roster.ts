import { chromium } from 'playwright';

const url = process.argv[2] || 'https://12thman.com/sports/mens-swimming-and-diving/roster';

async function inspectPage() {
  console.log(`\n🔍 Inspecting: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Check for common selectors
    const selectors = [
      '.sidearm-roster-players',
      '.roster-table',
      '.roster-grid',
      'ul.roster',
      '.s-person-card-list',
      '[class*="roster"]',
      '[class*="player"]',
      '[class*="athlete"]',
      'table',
    ];

    console.log('Testing selectors:\n');
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`✅ "${selector}" - found ${elements.length} elements`);

        // Get some sample HTML
        const firstElement = elements[0];
        const html = await firstElement.evaluate(el => el.outerHTML.substring(0, 500));
        console.log(`   Sample HTML: ${html}...\n`);
      }
    }

    // Get page HTML to analyze
    const bodyHTML = await page.content();
    const rosterMatches = bodyHTML.match(/class="[^"]*roster[^"]*"/gi);
    const playerMatches = bodyHTML.match(/class="[^"]*player[^"]*"/gi);

    console.log('\n📋 Classes containing "roster":');
    if (rosterMatches) {
      const unique = [...new Set(rosterMatches)];
      unique.slice(0, 10).forEach(m => console.log(`   ${m}`));
    }

    console.log('\n👤 Classes containing "player":');
    if (playerMatches) {
      const unique = [...new Set(playerMatches)];
      unique.slice(0, 10).forEach(m => console.log(`   ${m}`));
    }

    // Look for text that might be athlete names (capitalized words)
    console.log('\n🔍 Looking for potential athlete names...');
    const textContent = await page.textContent('body') || '';
    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const potentialNames = lines.filter(line => {
      // Look for patterns like "Firstname Lastname"
      const words = line.split(/\s+/);
      return words.length >= 2 && words.length <= 4 &&
             words.every(w => w.length > 1 && w[0] === w[0].toUpperCase());
    });
    console.log(`   Found ${potentialNames.length} potential names`);
    if (potentialNames.length > 0) {
      console.log('   Sample names:', potentialNames.slice(0, 5).join(', '));
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectPage();
