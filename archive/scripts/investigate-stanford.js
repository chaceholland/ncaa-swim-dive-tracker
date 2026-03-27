require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function main() {
  console.log('\n🔍 INVESTIGATING STANFORD ROSTER PAGE\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://gostanford.com/sports/mens-swimming-and-diving/roster', {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });

  console.log('Waiting for page to load...');
  await page.waitForTimeout(3000);

  // Investigate the page structure
  const pageInfo = await page.evaluate(() => {
    const results = {
      totalRosterLinks: 0,
      rosterLinks: [],
      imagePatterns: {},
      sampleAthletes: []
    };

    // Find all roster links
    const links = document.querySelectorAll('a[href*="/roster/"]');
    results.totalRosterLinks = links.length;

    // Get first 5 athlete links
    let count = 0;
    for (const link of links) {
      if (count >= 5) break;
      const href = link.getAttribute('href');
      if (!href || href.includes('coaches') || href.includes('staff')) continue;

      const name = link.textContent.trim();
      if (!name || name.length < 2) continue;

      const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
      results.rosterLinks.push({ name, url: fullUrl });
      count++;
    }

    // Check for different image patterns on roster page
    const allImages = document.querySelectorAll('img');
    results.totalImages = allImages.length;

    allImages.forEach(img => {
      const src = img.src || img.getAttribute('url') || '';
      if (!src) return;

      if (src.includes('imgproxy')) {
        results.imagePatterns['imgproxy'] = (results.imagePatterns['imgproxy'] || 0) + 1;
      } else if (src.includes('storage.googleapis.com')) {
        results.imagePatterns['google-storage'] = (results.imagePatterns['google-storage'] || 0) + 1;
      } else if (src.includes('wmt.digital')) {
        results.imagePatterns['wmt-digital'] = (results.imagePatterns['wmt-digital'] || 0) + 1;
      }
    });

    return results;
  });

  console.log('Page Info:');
  console.log('  Total roster links:', pageInfo.totalRosterLinks);
  console.log('  Total images:', pageInfo.totalImages);
  console.log('  Image patterns:', pageInfo.imagePatterns);
  console.log('\nSample athlete links:');
  pageInfo.rosterLinks.forEach(a => console.log('  -', a.name, '→', a.url));

  // Now visit the first athlete's page to see the structure
  if (pageInfo.rosterLinks.length > 0) {
    const firstAthlete = pageInfo.rosterLinks[0];
    console.log(`\n\n🔍 INVESTIGATING: ${firstAthlete.name}`);
    console.log(`URL: ${firstAthlete.url}\n`);

    await page.goto(firstAthlete.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const athleteInfo = await page.evaluate(() => {
      const images = [];
      const allImgs = document.querySelectorAll('img');

      allImgs.forEach(img => {
        const src = img.src || img.getAttribute('url') || '';
        const alt = img.alt || '';
        const className = img.className || '';

        if (!src) return;

        // Skip obvious non-athlete images
        if (src.includes('logo') || src.includes('footer') || src.includes('icon')) return;

        images.push({
          src: src.substring(0, 150),
          alt: alt.substring(0, 50),
          className: className.substring(0, 50),
          isImgproxy: src.includes('imgproxy'),
          isGoogleStorage: src.includes('storage.googleapis.com'),
          isWmtDigital: src.includes('wmt.digital')
        });
      });

      return { images };
    });

    console.log('Images found on athlete page:');
    athleteInfo.images.forEach((img, i) => {
      console.log(`\n  Image ${i + 1}:`);
      console.log(`    src: ${img.src}${img.src.length >= 150 ? '...' : ''}`);
      console.log(`    alt: ${img.alt}`);
      console.log(`    className: ${img.className}`);
      console.log(`    imgproxy: ${img.isImgproxy}, google: ${img.isGoogleStorage}, wmt: ${img.isWmtDigital}`);
    });
  }

  console.log('\n\nBrowser will stay open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
}

main();
