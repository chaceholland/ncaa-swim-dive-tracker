const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://lsusports.net/sports/sd/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  const athletes = await page.evaluate(() => {
    const results = [];
    
    // Find the Men's Roster section by looking for section-title containing "Men's"
    const sectionTitles = document.querySelectorAll('.section-title');
    let menSection = null;
    let womenSection = null;
    
    sectionTitles.forEach(title => {
      const text = title.textContent.trim();
      if (text === "Men's Roster") {
        menSection = title.closest('.togglers-container_tab') || title.nextElementSibling;
      }
    });
    
    // Better: find the tab containing "Men's Roster" title
    const tabs = document.querySelectorAll('.togglers-container_tab');
    tabs.forEach(tab => {
      const titleEl = tab.querySelector('.section-title');
      if (!titleEl) return;
      const titleText = titleEl.textContent.trim();
      
      if (titleText === "Men's Roster") {
        const items = tab.querySelectorAll('.roster-list_item');
        items.forEach(item => {
          const nameEl = item.querySelector('.roster-list_item_info_name');
          const posEl = item.querySelector('.roster-list_item_info_position');
          const name = nameEl ? nameEl.textContent.trim() : '';
          const pos = posEl ? posEl.textContent.trim() : '';
          if (name) results.push({ name, pos });
        });
      }
    });
    
    return results;
  });
  
  console.log('LSU Men:', athletes.length);
  athletes.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos));
  
  await browser.close();
})();
