// Check Kentucky and Utah scraped athletes vs. missing DB athletes
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Kentucky - get full roster
  console.log('=== Kentucky ===');
  await page.goto('https://ukathletics.com/sports/mswim/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(10000);
  const ky = await page.evaluate(() => {
    const athletes = [];
    const rows = document.querySelectorAll('tbody tr.odd, tbody tr.even');
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 5) return;
      const name = cells[0].textContent.trim();
      const classYear = cells[4].textContent.trim();
      if (name && name.length > 2) athletes.push({ name, classYear });
    });
    return athletes;
  });
  console.log('KY full roster:', ky.length, 'athletes');
  // Show only athletes whose class year might match the missing ones
  const missing = ['Cayden Pitzer', 'Levi Sandidge', 'Devin Naoroz', 'AJ Terry'];
  ky.forEach(a => {
    const norm = a.name.toLowerCase().replace(/[^a-z]/g, '');
    const isMissing = missing.some(m => m.toLowerCase().replace(/[^a-z]/g, '') === norm || 
      a.name.toLowerCase().includes(m.toLowerCase().split(' ')[1]));
    if (isMissing || missing.some(m => {
      const mParts = m.toLowerCase().split(' ');
      const aParts = a.name.toLowerCase().split(' ');
      return aParts.some(p => mParts.includes(p));
    })) {
      console.log(' MATCH:', a.name, '|', a.classYear);
    }
  });
  console.log('\nAll KY athletes with their class years:');
  ky.forEach(a => console.log(' ', a.name, '|', a.classYear));

  // Utah - get full roster  
  console.log('\n=== Utah ===');
  await page.goto('https://utahutes.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(15000);
  const utah = await page.evaluate(() => {
    const athletes = [];
    const cards = document.querySelectorAll('.s-person-card');
    cards.forEach(card => {
      const nameEl = card.querySelector('.s-person-details__personal-single-line, [class*="personal-single"]');
      const bioEl = card.querySelector('[data-test-id="s-person-details__bio-stats-person-title"]');
      if (nameEl) {
        athletes.push({ name: nameEl.textContent.trim(), classYear: bioEl ? bioEl.textContent.trim() : 'NO BIO' });
      }
    });
    return athletes;
  });
  console.log('Utah full roster:', utah.length, 'athletes');
  const utahMissing = ['Brody Lewis', 'McKay King'];
  utah.forEach(a => {
    const norm = a.name.toLowerCase().replace(/[^a-z]/g, '');
    const isMissing = utahMissing.some(m => m.toLowerCase().replace(/[^a-z]/g, '') === norm ||
      a.name.toLowerCase().includes(m.toLowerCase().split(' ')[1]));
    if (isMissing) console.log(' MATCH:', a.name, '|', a.classYear);
  });
  console.log('\nAll Utah athletes:');
  utah.forEach(a => console.log(' ', a.name, '|', a.classYear));

  await browser.close();
})().catch(e => console.error('Error:', e.message));
