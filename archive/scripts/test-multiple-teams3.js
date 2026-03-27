const { chromium } = require('playwright');

const teams = [
  { name: 'Florida', url: 'https://floridagators.com/sports/mens-swimming-and-diving/roster' },
  { name: 'Texas', url: 'https://texassports.com/sports/mens-swimming-and-diving/roster' },
];

async function scrapeTeam(page, team) {
  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    
    const athletes = await page.evaluate(() => {
      const results = [];
      
      // Try tables first (s-table)
      const tables = document.querySelectorAll('.s-table');
      if (tables.length > 0) {
        tables.forEach(table => {
          const headerRow = table.querySelector('.s-table-header__row--heading');
          const gender = headerRow ? headerRow.textContent.trim().toLowerCase() : 'unknown';
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const nameCell = row.querySelector('td:first-child');
            const posCell = row.querySelector('td:nth-child(2)');
            const name = nameCell ? nameCell.textContent.trim() : '';
            if (name && name.length > 2) {
              results.push({ gender, name, pos: posCell ? posCell.textContent.trim() : '' });
            }
          });
        });
        if (results.length > 0) return { source: 'table', athletes: results };
      }
      
      // Try s-person-card (Vue.js rendered)
      const cards = document.querySelectorAll('.s-person-card');
      if (cards.length > 0) {
        cards.forEach(card => {
          // The card text content includes name + details
          const allText = card.textContent.trim();
          // The link text is usually the name - find the first link
          const link = card.querySelector('a[href*="/roster/"]');
          const name = link ? link.textContent.trim() : '';
          const posEl = card.querySelector('[class*="position"], [class*="pos"]');
          const pos = posEl ? posEl.textContent.trim() : '';
          if (name && name.length > 1) {
            results.push({ gender: 'men', name, pos });
          }
        });
        if (results.length > 0) return { source: 'card', athletes: results };
      }
      
      // Inspect card structure
      const sampleCard = document.querySelector('.s-person-card');
      if (sampleCard) {
        const links = sampleCard.querySelectorAll('a');
        const allLinks = Array.from(links).map(l => ({ text: l.textContent.trim(), href: l.getAttribute('href') }));
        return { source: 'inspect', cardHtml: sampleCard.innerHTML.substring(0, 500), links: allLinks };
      }
      
      return { source: 'none', count: 0 };
    });
    
    if (athletes.source === 'table' || athletes.source === 'card') {
      console.log(`${team.name} (${athletes.source}): ${athletes.athletes.length} athletes`);
      athletes.athletes.slice(0, 3).forEach(a => console.log(`  - ${a.name} | ${a.pos} | ${a.gender}`));
    } else {
      console.log(`${team.name}: ${JSON.stringify(athletes)}`);
    }
  } catch(e) {
    console.log(`${team.name}: ERROR - ${e.message.substring(0, 80)}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  for (const team of teams) {
    await scrapeTeam(page, team);
    await new Promise(r => setTimeout(r, 1500));
  }
  await browser.close();
})();
