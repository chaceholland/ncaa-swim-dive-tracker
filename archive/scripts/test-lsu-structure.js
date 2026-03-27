const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const info = await page.evaluate(() => {
    // Find all section-title elements and their parent structure
    const sectionTitles = document.querySelectorAll('.section-title');
    return Array.from(sectionTitles).map(t => ({
      text: t.textContent.trim().substring(0, 40),
      parentCls: t.parentElement ? t.parentElement.className.substring(0, 60) : '',
      siblingCount: t.parentElement ? t.parentElement.children.length : 0,
      nextSiblingCls: t.nextElementSibling ? t.nextElementSibling.className.substring(0, 60) : ''
    })).slice(0, 10);
  });
  
  console.log('Section titles structure:', JSON.stringify(info, null, 2));
  
  await browser.close();
})();
