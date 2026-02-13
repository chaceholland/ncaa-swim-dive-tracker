require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function checkSwimCloudPennState() {
  console.log('Checking SwimCloud for Penn State...\n');

  const browser = await chromium.launch({ headless: false }); // Set to false to see what we're doing
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Navigate to Penn State team page on SwimCloud
    const teamUrl = 'https://www.swimcloud.com/team/2064/';
    console.log(`Navigating to: ${teamUrl}`);

    await page.goto(teamUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for the page to fully load
    await page.waitForTimeout(3000);

    // Take a screenshot to see the page structure
    await page.screenshot({ path: 'swimcloud-penn-state.png' });
    console.log('Screenshot saved: swimcloud-penn-state.png');

    // Check for athlete roster structure
    const pageInfo = await page.evaluate(() => {
      // Look for common roster selectors
      const selectors = [
        '.roster',
        '.athlete',
        '.swimmer',
        '[class*="roster"]',
        '[class*="athlete"]',
        'a[href*="/swimmer/"]',
        'a[href*="/athlete/"]'
      ];

      const results = {};
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[selector] = elements.length;
        }
      });

      // Get some sample athlete links
      const athleteLinks = [];
      document.querySelectorAll('a[href*="/swimmer/"]').forEach(link => {
        if (athleteLinks.length < 5) {
          athleteLinks.push({
            href: link.href,
            text: link.textContent.trim()
          });
        }
      });

      return {
        selectorCounts: results,
        sampleAthleteLinks: athleteLinks,
        pageTitle: document.title
      };
    });

    console.log('\nPage Info:', JSON.stringify(pageInfo, null, 2));

    // If we found athlete links, try visiting one
    if (pageInfo.sampleAthleteLinks.length > 0) {
      const firstAthlete = pageInfo.sampleAthleteLinks[0];
      console.log(`\nChecking first athlete: ${firstAthlete.text}`);
      console.log(`URL: ${firstAthlete.href}`);

      await page.goto(firstAthlete.href, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Check for photo
      const photoInfo = await page.evaluate(() => {
        const img = document.querySelector('img[src*="photo"], img[src*="athlete"], img.profile-photo, .athlete-photo img');
        if (img) {
          return {
            found: true,
            src: img.src,
            alt: img.alt,
            className: img.className
          };
        }
        return { found: false };
      });

      console.log('\nPhoto Info:', JSON.stringify(photoInfo, null, 2));

      await page.screenshot({ path: 'swimcloud-athlete-sample.png' });
      console.log('Athlete screenshot saved: swimcloud-athlete-sample.png');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkSwimCloudPennState().catch(console.error);
