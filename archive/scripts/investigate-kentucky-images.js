require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function investigateKentuckyImages() {
  console.log('\n🔍 INVESTIGATING KENTUCKY IMAGE URLS\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Test with Carson Hick's profile
  const testUrl = 'https://ukathletics.com/sports/swimming/roster/carson-hick/15085';

  console.log(`Navigating to: ${testUrl}\n`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const imageInfo = await page.evaluate(() => {
    const results = [];

    // Get all images on the page
    const allImages = document.querySelectorAll('img');

    allImages.forEach((img, index) => {
      const src = img.src;
      const alt = img.alt || '';
      const classes = img.className || '';

      // Only show images from athletic domains
      if (src.includes('ukathletics') || src.includes('storage.googleapis.com')) {
        results.push({
          index,
          src,
          alt: alt.substring(0, 50),
          classes: classes.substring(0, 50),
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      }
    });

    return results;
  });

  console.log('Found images:');
  imageInfo.forEach(img => {
    console.log(`\n[${img.index}]`);
    console.log(`  Alt: ${img.alt}`);
    console.log(`  Classes: ${img.classes}`);
    console.log(`  Size: ${img.width}x${img.height}`);
    console.log(`  URL: ${img.src}`);

    // Try to decode if it's an imgproxy URL
    if (img.src.includes('/imgproxy/')) {
      const match = img.src.match(/\/ce\/0\/([^.]+)/);
      if (match) {
        try {
          const base64Url = match[1];
          const originalUrl = Buffer.from(base64Url, 'base64').toString('utf-8');
          console.log(`  Decoded: ${originalUrl}`);
        } catch (e) {
          console.log(`  Could not decode imgproxy URL`);
        }
      }
    }
  });

  console.log('\n\nPress Ctrl+C to close...');
  await page.waitForTimeout(60000);

  await browser.close();
}

investigateKentuckyImages();
