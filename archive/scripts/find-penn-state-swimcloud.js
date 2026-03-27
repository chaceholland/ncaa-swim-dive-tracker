require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function findPennStateSwimCloud() {
  console.log('Searching for Penn State on SwimCloud...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Navigate to SwimCloud search or Penn State directly
    console.log('Navigating to SwimCloud...');
    await page.goto('https://www.swimcloud.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Try to search for Penn State
    const searchBox = await page.locator('input[type="search"], input[placeholder*="Search"]').first();
    if (await searchBox.isVisible()) {
      await searchBox.fill('Penn State University');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'swimcloud-search-results.png' });
      console.log('Search results screenshot saved');

      // Look for Penn State team link
      const teamLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/team/"]'));
        const pennStateLink = links.find(link =>
          link.textContent.toLowerCase().includes('penn state')
        );
        return pennStateLink ? { href: pennStateLink.href, text: pennStateLink.textContent } : null;
      });

      console.log('Found team link:', teamLink);

      if (teamLink) {
        await page.goto(teamLink.href, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'swimcloud-penn-state-roster.png' });
        console.log(`Navigated to Penn State: ${teamLink.href}`);
        console.log('Roster screenshot saved');
      }
    } else {
      // Try direct URL patterns
      const possibleUrls = [
        'https://www.swimcloud.com/team/penn-state-university/',
        'https://www.swimcloud.com/college/2/penn-state-university/',
        'https://www.swimcloud.com/college/pennstate/'
      ];

      for (const url of possibleUrls) {
        try {
          console.log(`Trying: ${url}`);
          await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
          const title = await page.title();
          console.log(`  Title: ${title}`);
          if (title.toLowerCase().includes('penn state')) {
            console.log(`  ✓ Found Penn State at: ${url}`);
            await page.screenshot({ path: 'swimcloud-penn-state-found.png' });
            break;
          }
        } catch (e) {
          console.log(`  ✗ Not found at this URL`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    console.log('\nBrowser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

findPennStateSwimCloud().catch(console.error);
