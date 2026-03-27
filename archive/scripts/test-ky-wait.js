const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Wait for a specific request
  const rosterDataPromise = page.waitForResponse(
    r => r.url().includes('wp-json') && r.url().includes('season'),
    { timeout: 15000 }
  ).catch(() => null);
  
  await page.goto('https://ukathletics.com/sports/mswim/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Try to click the season or trigger roster load
  await page.waitForTimeout(5000);
  
  // Now look for any roster content
  const content = await page.evaluate(() => {
    // Check if there are any rendered athlete elements
    const all = document.querySelectorAll('[class*="athlete"], [class*="player"], [class*="roster-member"], [class*="roster-card"]');
    const textItems = Array.from(all).map(el => el.textContent.trim().substring(0, 50));
    
    // Also check for any dynamic content containers
    const containers = document.querySelectorAll('[id*="roster"], [class*="roster"]');
    const containerInfo = Array.from(containers).map(c => ({ 
      tag: c.tagName, 
      id: c.id, 
      cls: c.className.substring(0, 60),
      childCount: c.children.length
    }));
    
    return { athleteCount: all.length, textItems: textItems.slice(0, 5), containers: containerInfo.slice(0, 10) };
  });
  
  console.log('Content:', JSON.stringify(content, null, 2));
  
  await browser.close();
})();
