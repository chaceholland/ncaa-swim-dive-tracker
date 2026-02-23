require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Debug Cal roster for Trey Hesser and Matthew Chai
  console.log('\n=== Cal roster (finding Hesser + Chai) ===');
  await page.goto('https://calbears.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const calLinks = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll('a').forEach(a => {
      const href = a.href || '';
      if (!href.includes('calbears.com') || seen.has(href)) return;
      if (!href.includes('/roster/') && !href.includes('/player/')) return;
      if (href.includes('/coaches/') || href.includes('#')) return;
      seen.add(href);
      const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
      const part = href.split('calbears.com')[1] || '';
      results.push({ text: text.slice(0, 50), part });
    });
    return results.filter(r => r.text || r.part.includes('hesser') || r.part.includes('chai'));
  });

  const allLinks = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="calbears.com"]').forEach(a => {
      if (seen.has(a.href)) return;
      seen.add(a.href);
      const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
      results.push({ text: text.slice(0, 50), href: a.href });
    });
    // Also try any href containing swimming roster paths
    document.querySelectorAll('a').forEach(a => {
      const href = a.href || '';
      const text = (a.textContent || '').trim();
      if ((text.toLowerCase().includes('hesser') || text.toLowerCase().includes('chai'))
          && !seen.has(href)) {
        seen.add(href);
        results.push({ text: text.slice(0, 50), href });
      }
    });
    return results.slice(0, 50);
  });
  console.log('Sample links with text:');
  allLinks.filter(l => l.text).slice(0, 30).forEach(l => console.log(`  [${l.text}] -> ${l.href.split('calbears.com')[1] || l.href}`));

  // Check page HTML for "hesser" and "chai"
  const pageText = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.filter(a => {
      const t = (a.textContent || '').toLowerCase();
      const h = (a.href || '').toLowerCase();
      return t.includes('hesser') || t.includes('chai') || h.includes('hesser') || h.includes('chai');
    }).map(a => ({ text: a.textContent?.trim(), href: a.href }));
  });
  console.log('\nHesser/Chai specific:');
  pageText.forEach(l => console.log(`  [${l.text}] -> ${l.href}`));

  // Also check Ohio State - try without trailing slash
  console.log('\n=== Ohio State ===');
  const osuUrls = [
    'https://ohiostatebuckeyes.com/sports/c-swim/roster',
    'https://ohiostatebuckeyes.com/sports/mens-c-swim/roster',
    'https://ohiostatebuckeyes.com/sports/mens-swimming-diving/roster',
  ];
  for (const url of osuUrls) {
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000);
      const title = await page.title();
      const count = await page.evaluate(() => document.querySelectorAll('a').length);
      console.log(`  ${url} -> "${title}" (${count} total links, status: ${resp?.status()})`);
    } catch (e) {
      console.log(`  ${url} -> ERROR`);
    }
  }

  // Also debug Aaron Shackell's Indiana profile
  console.log('\n=== Aaron Shackell Indiana profile ===');
  // First find his profile URL from DB via checking what URL was set
  await page.goto('https://iuhoosiers.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  const shackellLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const match = links.find(a => (a.textContent || '').toLowerCase().includes('shackell') || (a.href || '').toLowerCase().includes('shackell'));
    return match ? { text: match.textContent?.trim(), href: match.href } : null;
  });
  console.log('Shackell link:', shackellLink);

  if (shackellLink?.href) {
    await page.goto(shackellLink.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    const imgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src?.substring(0, 120),
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
        alt: img.alt,
      })).filter(i => i.w > 50 && i.h > 50);
    });
    imgs.forEach(i => console.log(`  ${i.w}x${i.h} [${i.alt}] ${i.src}`));
  }

  await browser.close();
}
main().catch(console.error);
