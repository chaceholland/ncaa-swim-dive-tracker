// Visit a few UNLV profile pages from the current roster to see what class year looks like
const { chromium } = require('playwright');
const profileUrls = [
  'http://unlvrebels.com/roster.aspx?rp_id=14688',
  'http://unlvrebels.com/roster.aspx?rp_id=14689',
  'http://unlvrebels.com/roster.aspx?rp_id=14700',
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Check if the UNLV website has different rp_ids - maybe we can find 2024-25 roster
  // First check what year the roster page says
  await page.goto('https://unlvrebels.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  const title = await page.evaluate(() => document.title + ' | ' + document.body.innerText.substring(0, 300).replace(/\n/g, ' | '));
  console.log('Roster page title/intro:', title.substring(0, 200));

  // Now check the DB athletes - do any match rp_ids?
  // DB athletes: Kyle Adamson, Logan Calhoun, Luke Guerrero, Hayden Lambert, Emil Perez, Ronan Robinson...
  // Try to find them via search or directly
  for (const url of profileUrls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const info = await page.evaluate(() => ({
      title: document.title.substring(0, 80),
      body: document.body.innerText.substring(0, 300).replace(/\n/g, ' | '),
    }));
    console.log('\n---', url);
    console.log('Title:', info.title);
    console.log('Body:', info.body.substring(0, 200));
  }

  await browser.close();
})().catch(e => console.error('Error:', e.message));
