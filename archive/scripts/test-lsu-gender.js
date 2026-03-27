const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const data = await page.evaluate(() => {
    // Look for section titles (men vs women)
    const sectionTitles = document.querySelectorAll('.section-title');
    const titles = Array.from(sectionTitles).map(t => t.textContent.trim());
    
    // Look for toggler tabs
    const tabs = document.querySelectorAll('.togglers-container_tab');
    const tabTexts = Array.from(tabs).map(t => t.textContent.trim());
    
    // Total roster items count
    const rosterItems = document.querySelectorAll('.roster-list_item');
    
    return { titles, tabs: tabTexts, itemCount: rosterItems.length };
  });
  
  console.log('Section titles:', data.titles);
  console.log('Tabs:', data.tabs);
  console.log('Item count:', data.itemCount);
  
  await browser.close();
})();
