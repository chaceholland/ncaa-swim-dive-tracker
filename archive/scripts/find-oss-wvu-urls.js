const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Ohio State - try different URLs
  const ohioUrls = [
    'https://ohiostatebuckeyes.com/sports/m-swim/roster',
    'https://ohiostatebuckeyes.com/sports/swim/roster',
    'https://ohiostatebuckeyes.com/sports/swimming/roster',
    'https://ohiostatebuckeyes.com/sports/mens-swimming/roster',
  ];
  
  for (const url of ohioUrls) {
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const finalUrl = page.url();
      const title = await page.title();
      if (!finalUrl.includes('404') && !title.includes('404') && !title.includes('Page Not Found')) {
        console.log('Ohio State:', url, '→', finalUrl, '| title:', title.substring(0, 50));
        break;
      }
    } catch(e) {
      console.log('Ohio State error:', url, e.message.substring(0, 50));
    }
  }
  
  // West Virginia
  const wvuUrls = [
    'https://wvusports.com/sports/swimming/roster',
    'https://wvusports.com/sports/m-swimming/roster',
    'https://wvusports.com/sports/mens-swimming/roster',
    'https://wvusports.com/sports/swim-dive/roster',
    'https://wvusports.com/sports/swimming-and-diving/roster',
  ];
  
  for (const url of wvuUrls) {
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const finalUrl = page.url();
      const title = await page.title();
      if (!finalUrl.includes('404') && !title.includes('404') && !title.includes('Page Not Found')) {
        console.log('West Virginia:', url, '→', finalUrl, '| title:', title.substring(0, 50));
        break;
      }
    } catch(e) {}
  }
  
  await browser.close();
})();
