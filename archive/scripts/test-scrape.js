const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Starting test...');

  try {
    // Test Supabase connection
    console.log('Testing Supabase connection...');
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name')
      .limit(3);

    if (error) {
      console.error('Supabase error:', error);
    } else {
      console.log('✓ Supabase connected. Found teams:', teams.map(t => t.name));
    }

    // Test Playwright
    console.log('Launching Playwright...');
    const browser = await chromium.launch({ headless: true });
    console.log('✓ Browser launched');

    const page = await browser.newPage();
    console.log('✓ Page created');

    // Test scraping a simple page
    const testUrl = 'https://gopack.com/sports/mens-swimming-and-diving/roster';
    console.log(`\nScraing test URL: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✓ Page loaded');

    await page.waitForTimeout(5000);
    console.log('✓ Waited for JS rendering');

    const athletes = await page.evaluate(() => {
      const results = [];
      const players = document.querySelectorAll('.sidearm-roster-players .sidearm-roster-player');
      console.log(`Found ${players.length} players`);

      players.forEach((player, idx) => {
        if (idx < 3) {
          const nameEl = player.querySelector('.sidearm-roster-player-name');
          const photoEl = player.querySelector('img.sidearm-roster-player-image');
          if (nameEl) {
            results.push({
              name: nameEl.textContent.trim(),
              photo_url: photoEl ? (photoEl.getAttribute('src') || photoEl.getAttribute('data-src')) : null,
            });
          }
        }
      });

      return results;
    });

    console.log('✓ Extracted athletes:', athletes);

    await browser.close();
    console.log('\n✓ Test completed successfully');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
