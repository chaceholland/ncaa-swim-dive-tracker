require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('\n🔍 Trying SEC Conference Website for LSU\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Try SEC Sports website
  try {
    await page.goto('https://www.secsports.com/roster/lsu/swimming-diving', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await page.waitForTimeout(3000);

    const athletes = await page.evaluate(() => {
      const results = [];

      // Look for athlete cards or roster entries
      const selectors = [
        '.roster-card',
        '.athlete-card',
        '[class*="roster"]',
        '[class*="athlete"]',
        '[class*="player"]'
      ];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          const nameEl = el.querySelector('[class*="name"]');
          const imgEl = el.querySelector('img');

          if (nameEl && imgEl) {
            results.push({
              name: nameEl.textContent.trim(),
              photoUrl: imgEl.src
            });
          }
        });
      });

      return results;
    });

    console.log('SEC Sports results:', athletes.length);
    if (athletes.length > 0) {
      console.log('Sample:', athletes.slice(0, 3));
    }

  } catch (error) {
    console.log('SEC Sports failed:', error.message);
  }

  // Try LSU official athletics site roster page with screenshots
  try {
    console.log('\nTrying LSU roster page with visual inspection...');

    await page.goto('https://lsusports.net/sports/sd/roster/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await page.waitForTimeout(5000);

    // Take a screenshot to see what's actually there
    await page.screenshot({ path: '/tmp/lsu-roster.png', fullPage: false });
    console.log('Screenshot saved to /tmp/lsu-roster.png');

    // Try clicking on an athlete to see their page
    const athleteLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/roster/player/"]').forEach(link => {
        const text = link.textContent.trim();
        if (text && text.length > 0 && text.length < 50) {
          links.push({
            name: text,
            url: link.href
          });
        }
      });
      return links.slice(0, 3); // First 3
    });

    console.log(`\nFound ${athleteLinks.length} athlete links`);

    for (const athlete of athleteLinks) {
      console.log(`\nChecking ${athlete.name}...`);

      await page.goto(athlete.url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      await page.waitForTimeout(3000);

      // Take screenshot of athlete page
      const filename = `/tmp/lsu-${athlete.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      await page.screenshot({ path: filename, fullPage: false });
      console.log(`  Screenshot: ${filename}`);

      // Look for any large images
      const largeImages = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .filter(img => {
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            return w >= 200 && h >= 200;
          })
          .map(img => ({
            src: img.src,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            alt: img.alt
          }))
          .slice(0, 5);
      });

      console.log(`  Large images found: ${largeImages.length}`);
      largeImages.forEach((img, i) => {
        console.log(`    ${i + 1}. ${img.width}x${img.height} - ${img.src.substring(0, 60)}...`);
      });
    }

  } catch (error) {
    console.log('LSU site failed:', error.message);
  }

  await browser.close();

  console.log('\n✅ Check screenshots in /tmp/ directory');
}

main().catch(console.error);
