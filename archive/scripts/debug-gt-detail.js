require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function debugGT() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const url = 'https://ramblinwreck.com/sports/c-swim/roster';

  try {
    console.log(`Loading: ${url}\n`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      // Find the table
      const table = document.querySelector('.roster__table, table');

      if (!table) {
        return { error: 'No table found' };
      }

      // Get all rows
      const rows = Array.from(table.querySelectorAll('tr'));

      const athletes = [];

      rows.forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const cellTexts = cells.map(c => c.textContent.trim());

        // Try to find name in the row
        const nameCell = cells.find(cell => {
          const text = cell.textContent.trim();
          return text.length > 2 &&
                 !text.match(/^\d+$/) && // Not just a number
                 !text.toLowerCase().includes('year') &&
                 !text.toLowerCase().includes('class') &&
                 text.split(' ').length >= 2; // Has at least 2 words (first + last name)
        });

        if (nameCell && index < 10) { // First 10 rows for sample
          athletes.push({
            rowIndex: index,
            cellTexts,
            classes: row.className,
            name: nameCell.textContent.trim()
          });
        }
      });

      return {
        tableFound: true,
        rowCount: rows.length,
        sampleAthletes: athletes
      };
    });

    console.log('=== GEORGIA TECH TABLE INFO ===');
    if (info.error) {
      console.log(`Error: ${info.error}`);
    } else {
      console.log(`Table found: ${info.tableFound}`);
      console.log(`Total rows: ${info.rowCount}`);
      console.log(`\nSample athletes (first 10 rows):`);
      info.sampleAthletes.forEach(a => {
        console.log(`\n[Row ${a.rowIndex}] ${a.name}`);
        console.log(`  Classes: ${a.classes || 'none'}`);
        console.log(`  Cells: ${a.cellTexts.join(' | ')}`);
      });
    }

    await browser.close();
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await browser.close();
  }
}

debugGT();
