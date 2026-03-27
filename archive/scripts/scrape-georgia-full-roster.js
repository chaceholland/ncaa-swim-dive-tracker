const { chromium } = require('playwright');

async function scrapeGeorgiaRoster() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Scraping Georgia roster from georgiadogs.com...\n');
  
  await page.goto('https://georgiadogs.com/sports/mens-swimming-and-diving/roster', { 
    waitUntil: 'domcontentloaded', 
    timeout: 30000 
  });
  await page.waitForTimeout(3000);
  
  // Try multiple selectors
  const athletes = await page.evaluate(() => {
    let athleteLinks = [];
    
    // Try various common selectors
    const selectors = [
      'a.sidearm-roster-player-name',
      '.sidearm-roster-players a',
      '.roster-player a',
      'a[href*="/roster/"]',
      '.s-person-card a',
      'div.sidearm-roster-player a'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        athleteLinks = Array.from(elements).map(link => ({
          name: link.textContent.trim(),
          url: link.href
        })).filter(a => a.name && a.name.length > 2);
        
        if (athleteLinks.length > 0) {
          console.log(`Found ${athleteLinks.length} athletes with selector: ${selector}`);
          break;
        }
      }
    }
    
    return athleteLinks;
  });
  
  if (athletes.length === 0) {
    console.log('No athletes found with standard selectors. Checking page content...');
    
    // Get all links and filter for roster-related ones
    const allAthletes = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .filter(link => link.href.includes('/roster/') && !link.href.endsWith('/roster/'))
        .map(link => ({
          name: link.textContent.trim(),
          url: link.href
        }))
        .filter(a => a.name && a.name.length > 2 && a.name.length < 50);
    });
    
    console.log(`Found ${allAthletes.length} athletes from all roster links:\n`);
    allAthletes.forEach((a, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${a.name}`);
    });
  } else {
    console.log(`Found ${athletes.length} athletes on Georgia roster:\n`);
    athletes.forEach((a, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${a.name}`);
    });
  }
  
  await browser.close();
}

scrapeGeorgiaRoster();
