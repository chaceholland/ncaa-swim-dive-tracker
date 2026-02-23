require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function main() {
  console.log('\n🔍 DEBUGGING: LSU Athlete Photos\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Test with one athlete profile
  const testUrl = 'https://lsusports.net/sports/sd/roster/player/jon-avdiu/';

  console.log(`Navigating to: ${testUrl}\n`);

  await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  console.log('Page title:', await page.title());

  // Check for specific bio photo containers
  const bioPhotoInfo = await page.evaluate(() => {
    const selectors = [
      '.s-person-card__photo',
      '.roster-bio-photo',
      '.player-photo',
      '.athlete-photo',
      '[class*="headshot"]',
      '[class*="bio-photo"]',
    ];

    const results = [];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        results.push({
          selector: sel,
          html: el.outerHTML.substring(0, 200),
          hasImg: !!el.querySelector('img')
        });
      }
    });

    return results;
  });

  if (bioPhotoInfo.length > 0) {
    console.log('\nBio photo containers found:');
    bioPhotoInfo.forEach(info => {
      console.log(`  ${info.selector}: ${info.hasImg ? 'HAS IMAGE' : 'no image'}`);
      console.log(`    ${info.html}...`);
    });
  } else {
    console.log('\nNo bio photo containers found');
  }

  // Check all images on the page
  const images = await page.evaluate(() => {
    const allImages = Array.from(document.querySelectorAll('img'));

    return allImages.map(img => ({
      src: img.src,
      alt: img.alt || '',
      class: img.className || '',
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      hasUrlAttr: img.hasAttribute('url'),
      urlAttr: img.getAttribute('url')
    }));
  });

  console.log(`\nFound ${images.length} images:\n`);

  // Filter to portrait-oriented images
  const portraitImages = images.filter(img => {
    if (img.width === 0 || img.height === 0) return false;
    const aspectRatio = img.width / img.height;
    return aspectRatio >= 0.5 && aspectRatio <= 0.8;
  });

  console.log(`Portrait-oriented images (${portraitImages.length}):\n`);

  portraitImages.forEach((img, i) => {
    console.log(`Image ${i + 1}:`);
    console.log(`  src: ${img.src}`);
    console.log(`  alt: ${img.alt}`);
    console.log(`  class: ${img.class}`);
    console.log(`  size: ${img.width}x${img.height}`);
    console.log(`  aspect ratio: ${(img.width / img.height).toFixed(2)}`);
    if (img.hasUrlAttr) {
      console.log(`  url attribute: ${img.urlAttr}`);
    }
    console.log('');
  });

  // Take a screenshot
  await page.screenshot({ path: 'lsu-athlete-debug.png', fullPage: true });
  console.log('Screenshot saved to lsu-athlete-debug.png');

  await browser.close();
}

main();
