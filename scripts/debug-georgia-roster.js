const { chromium } = require('playwright');

async function debugGeorgiaRoster() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Loading Georgia roster page...\n');
  
  await page.goto('https://georgiadogs.com/sports/mens-swimming-and-diving/roster', { 
    waitUntil: 'domcontentloaded', 
    timeout: 30000 
  });
  
  // Wait significantly longer for content
  console.log('Waiting for content to load...');
  await page.waitForTimeout(5000);
  
  // Check what we can find
  const found = await page.evaluate(() => {
    // Try to find the roster container
    const tables = document.querySelectorAll('table');
    const divs = document.querySelectorAll('div[class*="roster"]');
    const links = document.querySelectorAll('a[href*="roster"]');
    
    // Look for names specifically  
    const names = [];
    document.querySelectorAll('a').forEach(link => {
      const text = link.textContent.trim();
      const href = link.href || '';
      if (href.includes('/roster/') && text.length > 3 && text.length < 50 && !href.endsWith('/roster/') && !href.endsWith('/roster')) {
        names.push({ name: text, url: href });
      }
    });
    
    return {
      tableCount: tables.length,
      rosterDivs: divs.length,
      rosterLinks: links.length,
      foundNames: names
    };
  });
  
  console.log('Found on page:', found);
  
  if (found.foundNames && found.foundNames.length > 0) {
    console.log(`\nFound ${found.foundNames.length} athletes:\n`);
    found.foundNames.forEach((a, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${a.name}`);
    });
  }
  
  await page.waitForTimeout(2000);
  await browser.close();
}

debugGeorgiaRoster();
