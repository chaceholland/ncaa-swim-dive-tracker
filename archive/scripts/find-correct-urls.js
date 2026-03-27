const { chromium } = require('playwright');

const teams = [
  { name: 'Duke', base: 'https://goduke.com', keywords: ['swim', 'dive', 'swim-dive'] },
  { name: 'Missouri', base: 'https://mutigers.com', keywords: ['swim', 'dive'] },
  { name: 'TCU', base: 'https://gofrogs.com', keywords: ['swim', 'dive'] },
  { name: 'West Virginia', base: 'https://wvusports.com', keywords: ['swim', 'dive'] },
  { name: 'Virginia Tech', base: 'https://hokiesports.com', keywords: ['swim', 'dive'] },
  { name: 'Ohio State', base: 'https://ohiostatebuckeyes.com', keywords: ['swim', 'dive', 'm-swim'] },
  { name: 'Auburn', base: 'https://auburntigers.com', keywords: ['swim', 'dive'] },
];

async function findRosterUrl(page, team) {
  // Try to navigate to the base sports page
  const testUrls = [
    `${team.base}/sports/swimming-and-diving/roster`,
    `${team.base}/sports/mens-swimming-and-diving/roster`,
    `${team.base}/sports/swimming/roster`,
    `${team.base}/sports/m-swim/roster`,
    `${team.base}/sports/swim-dive/roster`,
    `${team.base}/sports/men-swimming-and-diving/roster`,
    `${team.base}/sports/m-swimming/roster`,
  ];
  
  for (const url of testUrls) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const finalUrl = page.url();
      const status = response ? response.status() : 0;
      const title = await page.title();
      
      if (status === 200 && !finalUrl.includes('/404') && !title.includes('404')) {
        if (title.toLowerCase().includes('swim') || title.toLowerCase().includes('roster')) {
          console.log(`${team.name}: FOUND ${url} → ${finalUrl}`);
          console.log(`  title: ${title.substring(0, 60)}`);
          return finalUrl;
        }
      }
    } catch(e) {}
  }
  
  console.log(`${team.name}: NOT FOUND via URL guessing`);
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const team of teams) {
    await findRosterUrl(page, team);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
})();
