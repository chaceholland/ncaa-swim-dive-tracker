const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://rolltide.com/sports/swimming-and-diving/roster', { waitUntil: 'networkidle', timeout: 45000 });
  
  const athletes = await page.evaluate(() => {
    const results = [];
    const tables = document.querySelectorAll('.s-table');
    tables.forEach(table => {
      const headerRow = table.querySelector('.s-table-header__row--heading');
      const gender = headerRow ? headerRow.textContent.trim() : '';
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const nameCell = row.querySelector('td:first-child a, td:first-child');
        const posCell = row.querySelector('td:nth-child(2)');
        const yearCell = row.querySelector('td:nth-child(3)');
        const name = nameCell ? nameCell.textContent.trim() : '';
        if (name && name.length > 2) {
          results.push({ gender, name, pos: posCell ? posCell.textContent.trim() : '', year: yearCell ? yearCell.textContent.trim() : '' });
        }
      });
    });
    return results;
  });
  
  const men = athletes.filter(a => {
    const g = a.gender.toLowerCase();
    return g.includes('men') && !g.includes('women');
  });
  const women = athletes.filter(a => a.gender.toLowerCase().includes('women'));
  
  console.log('Total:', athletes.length, '| Men:', men.length, '| Women:', women.length);
  console.log('\nSample men:');
  men.slice(0, 5).forEach(a => console.log(' -', a.name, '|', a.pos, '|', a.year));
  
  await browser.close();
})();
