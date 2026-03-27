const { chromium } = require('playwright');

const teams = [
  { name: 'Kentucky', url: 'https://ukathletics.com/sports/mswim/roster' },
  { name: 'LSU', url: 'https://lsusports.net/sports/sd/roster' },
  { name: 'Texas A&M', url: 'https://12thman.com/sports/swimdive/roster' },
  { name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/mens-swimming-and-diving/roster' },
];

async function scrapeAthletes(page, url, teamName) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  return await page.evaluate((tName) => {
    const results = [];
    
    // Method 1: s-table with gender sections
    const tables = document.querySelectorAll('.s-table');
    if (tables.length > 0) {
      tables.forEach(table => {
        const headerRow = table.querySelector('.s-table-header__row--heading');
        const gender = headerRow ? headerRow.textContent.trim().toLowerCase() : 'men';
        // Only include if gender is men (or unknown = men's URL)
        const isMen = gender.includes('men') && !gender.includes('women');
        if (!isMen && gender !== 'men') return;
        
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const nameCell = row.querySelector('td:first-child');
          const posCell = row.querySelector('td:nth-child(2)');
          const name = nameCell ? nameCell.textContent.trim() : '';
          if (name && name.length > 2) {
            results.push({ name, pos: posCell ? posCell.textContent.trim() : '' });
          }
        });
      });
      if (results.length > 0) return { method: 'table', results };
    }
    
    // Method 2: s-person-card (all men since it's a men's URL)
    const cards = document.querySelectorAll('.s-person-card');
    if (cards.length > 0) {
      cards.forEach(card => {
        const nameEl = card.querySelector('h3, [class*="personal-single-line"]');
        const name = nameEl ? nameEl.textContent.trim() : '';
        
        // Get position from bio stats
        const bioStats = card.querySelectorAll('[class*="bio-stats-item"]');
        let pos = '';
        let year = '';
        bioStats.forEach(stat => {
          const text = stat.textContent.trim();
          if (text.startsWith('Position ')) pos = text.replace('Position ', '');
          if (text.startsWith('Academic Year ')) year = text.replace('Academic Year ', '');
        });
        
        if (name) results.push({ name, pos, year });
      });
      if (results.length > 0) return { method: 'card', results };
    }
    
    // Method 3: Old sidearm player markup
    const oldPlayers = document.querySelectorAll('.sidearm-roster-player');
    if (oldPlayers.length > 0) {
      oldPlayers.forEach(player => {
        const nameEl = player.querySelector('.sidearm-roster-player-name');
        const posEl = player.querySelector('.sidearm-roster-player-position');
        const name = nameEl ? nameEl.textContent.trim() : '';
        if (name) results.push({ name, pos: posEl ? posEl.textContent.trim() : '' });
      });
      if (results.length > 0) return { method: 'old-sidearm', results };
    }
    
    return { method: 'none', results: [] };
  }, teamName);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  for (const team of teams) {
    try {
      const data = await scrapeAthletes(page, team.url, team.name);
      console.log(`${team.name} (${data.method}): ${data.results.length} athletes`);
      data.results.slice(0, 3).forEach(a => console.log(`  - ${a.name} | ${a.pos}`));
    } catch(e) {
      console.log(`${team.name}: ERROR - ${e.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  
  await browser.close();
})();
