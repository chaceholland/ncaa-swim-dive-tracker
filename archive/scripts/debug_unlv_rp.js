// The 2021-22 roster has rp_ids 14688-14738 range. Check if newer athletes have higher rp_ids
const { chromium } = require('playwright');

// DB athletes to find (from the 22 missing)
const targets = [
  'Kyle Adamson', 'Logan Calhoun', 'Luke Guerrero', 'Hayden Lambert',
  'Emil Perez', 'Ronan Robinson', 'Bronson Smothers', 'Evan Stingley',
  'Ambrus Barcsak', 'Lucas Diermayr', 'Yamato Lucero', 'Wikus Potgieter',
  'Evan Sproul', 'Nate Thomason', 'Ian Belflower', 'Aidan Favela',
  'Tatsuki Inoue', 'Wes Mank', 'Colby Raffel', 'Gabriel Schreiber',
  'Kiril Stepanov', 'Alex Vazquez'
];
const targetNames = new Set(targets.map(n => n.toLowerCase().replace(/[^a-z]/g, '')));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Try a range of rp_ids beyond the 2021-22 range (14688-14738)
  // Try 14739-14800 to find newer athletes
  let found = 0;
  for (let rp = 14739; rp <= 14800 && found < 5; rp++) {
    const url = `https://unlvrebels.com/roster.aspx?rp_id=${rp}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const title = document.title;
      const body = document.body.innerText.substring(0, 400);
      const m = body.match(/\b(Freshman|Sophomore|Junior|Senior|Graduate)\b/i);
      return { title: title.substring(0, 60), classYear: m ? m[1] : null, is404: title.includes('404') || title.includes('Not Found') };
    });
    if (!info.is404) {
      const nameNorm = info.title.replace(/\s*-\s*.*/, '').toLowerCase().replace(/[^a-z]/g, '');
      const isTarget = targetNames.has(nameNorm);
      console.log(`rp_id=${rp}: "${info.title}" | class: ${info.classYear} | isTarget: ${isTarget}`);
      if (isTarget) found++;
    }
  }
  console.log('Done. Found', found, 'target athletes.');
  await browser.close();
})().catch(e => console.error('Error:', e.message));
