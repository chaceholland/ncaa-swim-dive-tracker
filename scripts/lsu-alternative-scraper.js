require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function decodeImgproxyUrl(imgproxyPath, baseUrl) {
  try {
    // Extract the base64 part from imgproxy URL
    // Format: /imgproxy/{signature}/fit/{width}/{height}/ce/0/{base64}
    const parts = imgproxyPath.split('/');
    const base64Part = parts[parts.length - 1];

    if (!base64Part) return null;

    // Decode base64
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');

    // If it's a full URL, return it
    if (decoded.startsWith('http')) {
      return decoded;
    }

    // Otherwise, make it absolute
    return new URL(decoded, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

async function scrapeAthlete(page, athleteName, baseUrl) {
  try {
    const slug = athleteName.toLowerCase().replace(/\s+/g, '-');
    const url = `${baseUrl}/sports/sd/roster/player/${slug}/`;

    console.log(`\n${athleteName}:`);
    console.log(`  URL: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);

    const photoInfo = await page.evaluate((pageUrl) => {
      // Look for ALL images including background images
      const allImages = [];

      // Regular img tags
      document.querySelectorAll('img').forEach(img => {
        allImages.push({
          type: 'img',
          src: img.src || img.getAttribute('data-src') || img.getAttribute('url'),
          alt: img.alt,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      });

      // Elements with background images
      document.querySelectorAll('*').forEach(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
          const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
          if (urlMatch) {
            allImages.push({
              type: 'background',
              src: urlMatch[1],
              element: el.tagName
            });
          }
        }
      });

      // Look for specific athlete photo containers
      const photoContainers = [
        '.player-photo',
        '.athlete-photo',
        '.bio-photo',
        '.headshot',
        '[class*="photo"]',
        '[class*="headshot"]',
        '[class*="image"]'
      ];

      const containerImages = [];
      photoContainers.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          const img = el.querySelector('img');
          if (img) {
            containerImages.push({
              type: 'container',
              selector,
              src: img.src || img.getAttribute('data-src') || img.getAttribute('url')
            });
          }
        });
      });

      return {
        allImages: allImages.slice(0, 20), // First 20
        containerImages,
        totalImages: allImages.length
      };
    }, url);

    console.log(`  Total images: ${photoInfo.totalImages}`);

    // Check imgproxy URLs
    const imgproxyImages = photoInfo.allImages.filter(img =>
      img.src && img.src.includes('imgproxy')
    );

    if (imgproxyImages.length > 0) {
      console.log(`  Found ${imgproxyImages.length} imgproxy images`);

      for (const img of imgproxyImages) {
        const decoded = decodeImgproxyUrl(img.src, baseUrl);
        if (decoded && decoded.includes('storage.googleapis.com')) {
          console.log(`  ✅ Decoded imgproxy URL: ${decoded.substring(0, 80)}...`);

          // Check if it's a reasonable size for a headshot
          if (img.width >= 200 && img.height >= 200) {
            return decoded;
          }
        }
      }
    }

    // Look for any Google Storage images
    const storageImages = photoInfo.allImages.filter(img =>
      img.src && img.src.includes('storage.googleapis.com') &&
      !img.src.includes('logo')
    );

    if (storageImages.length > 0) {
      console.log(`  Found ${storageImages.length} Google Storage images`);
      // Return the largest one
      storageImages.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      if (storageImages[0].width >= 200) {
        console.log(`  ✅ Using: ${storageImages[0].src.substring(0, 80)}...`);
        return storageImages[0].src;
      }
    }

    console.log(`  ❌ No suitable headshot found`);
    return null;

  } catch (error) {
    console.log(`  ⚠️ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🔍 LSU Alternative Headshot Scraper\n');

  const baseUrl = 'https://lsusports.net';

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, logo_url')
    .eq('name', 'LSU')
    .single();

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('team_id', team.id)
    .order('name');

  console.log(`Found ${athletes.length} LSU athletes\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let found = 0;

  for (const athlete of athletes) {
    const photoUrl = await scrapeAthlete(page, athlete.name, baseUrl);

    if (photoUrl) {
      // Use image proxy for optimization
      const optimizedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(photoUrl)}&w=400&h=400&fit=cover&output=webp`;

      await supabase
        .from('athletes')
        .update({ photo_url: optimizedUrl })
        .eq('id', athlete.id);

      found++;
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Found ${found}/${athletes.length} headshots`);
  console.log('='.repeat(70));
}

main().catch(console.error);
