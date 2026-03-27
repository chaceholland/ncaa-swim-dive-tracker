require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function testProfile() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Test Louisville - Aidan Paro
  const testName = 'Aidan Paro';
  const slug = createSlug(testName);
  const baseUrl = 'https://gocards.com/sports/mens-swimming-and-diving/roster';
  const profileUrl = `${baseUrl}/${slug}`;

  console.log(`Testing: ${testName}`);
  console.log(`Slug: ${slug}`);
  console.log(`URL: ${profileUrl}\n`);

  try {
    console.log('Navigating...');
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);

    console.log('Page loaded. Checking for photo...\n');

    // Check what images exist on the page
    const allImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        className: img.className,
        alt: img.alt
      }));
    });

    console.log('=== ALL IMAGES ON PAGE ===');
    allImages.forEach((img, i) => {
      console.log(`\n[${i + 1}] ${img.src}`);
      console.log(`    Class: ${img.className || 'none'}`);
      console.log(`    Alt: ${img.alt || 'none'}`);
    });

    // Try selectors
    const photoUrl = await page.evaluate(() => {
      const selectors = [
        'img.sidearm-roster-player-image',
        'img.roster-bio-photo__image',
        'img[src*="imgproxy"]',
        'img[src*="sidearmdev"]',
        'img[src*="cloudfront"]',
        'img[src*="storage.googleapis"]',
        '.bio-photo img',
        '.player-image img'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src &&
            !img.src.includes('logo') &&
            !img.src.includes('placeholder') &&
            !img.src.startsWith('data:image')) {
          return { selector, src: img.src };
        }
      }
      return null;
    });

    console.log('\n=== SELECTOR RESULT ===');
    if (photoUrl) {
      console.log(`✅ Found with selector: ${photoUrl.selector}`);
      console.log(`URL: ${photoUrl.src}`);
    } else {
      console.log('❌ No photo found with any selector');
    }

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
  }

  await page.waitForTimeout(5000); // Keep browser open for inspection
  await browser.close();
}

testProfile();
