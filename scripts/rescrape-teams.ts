import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface AthleteData {
  name: string;
  photo_url?: string;
  athlete_type?: 'swimmer' | 'diver';
  class_year?: string;
  hometown?: string;
  profile_url?: string;
}

// Teams to re-scrape with their roster URLs
const teamsToScrape = [
  { name: 'Texas A&M', url: 'https://12thman.com/sports/swimdive/roster' },
  { name: 'Auburn', url: 'https://auburntigers.com/sports/swimming-diving/roster' },
];

async function scrapeTeam(teamName: string, rosterUrl: string, teamId: string) {
  console.log(`\n🏊 Scraping ${teamName}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to roster page with longer timeout
    await page.goto(rosterUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait a bit for JavaScript to render (especially for Sidearm sites)
    await page.waitForTimeout(8000);

    const athletes: AthleteData[] = [];

    // Try multiple selector patterns
    const patterns = [
      // Pattern 0: WMT Digital (Auburn-style) - Men's roster in list
      {
        container: 'body',
        item: 'li',
        name: 'h3 a',
        photo: 'img',
        position: 'strong',
        year: 'strong:first-of-type',
        hometown: 'generic',
        filter: async (item: any) => {
          // Only get list items that have h3 athlete names
          const h3 = await item.$('h3 a');
          return !!h3;
        }
      },
      // Pattern 1: Sidearm Sports (most common)
      {
        container: '.sidearm-roster-players',
        item: '.sidearm-roster-player',
        name: '.sidearm-roster-player-name, h3, .sidearm-roster-player-name-link',
        photo: 'img.sidearm-roster-player-image, img.roster-image',
        position: '.sidearm-roster-player-position, .position',
        year: '.sidearm-roster-player-academic-year, .year, .class',
        hometown: '.sidearm-roster-player-hometown, .hometown',
      },
      // Pattern 2: Roster table
      {
        container: '.roster-table, table.roster',
        item: 'tr.player, tbody tr',
        name: 'td.name a, td:first-child a, .player-name',
        photo: 'img',
        position: 'td.position, .position',
        year: 'td.year, .year, td.class',
        hometown: 'td.hometown, .hometown',
      },
      // Pattern 3: Card/Grid layouts
      {
        container: '.roster-grid, .athlete-grid, .player-cards',
        item: '.roster-card, .athlete-card, .player-card',
        name: '.name, h3, .player-name',
        photo: 'img',
        position: '.position, .event',
        year: '.year, .class',
        hometown: '.hometown',
      },
      // Pattern 4: List items
      {
        container: 'ul.roster, .roster-list',
        item: 'li.player, li.athlete',
        name: '.name, h3, h4',
        photo: 'img',
        position: '.position',
        year: '.year, .class',
        hometown: '.hometown',
      },
      // Pattern 5: Sidearm new design (Texas A&M)
      {
        container: '.c-rosterpage__players',
        item: '.s-person-card',
        name: 'h3',
        photo: 'img',
        position: '.s-text-paragraph',
        year: '.s-text-paragraph',
        hometown: '.s-person-card__content__location',
      },
      // Pattern 6: Prestige/Custom platforms
      {
        container: '.s-person-card-list, .roster-container',
        item: '.s-person-card, .athlete-item, article',
        name: '.s-person-card__name, .athlete-name, h3',
        photo: 'img',
        position: '.s-person-card__meta, .position',
        year: '.class-year, .year',
        hometown: '.hometown',
      },
    ];

    for (const pattern of patterns) {
      const container = await page.$(pattern.container);
      if (!container) continue;

      let items = await container.$$(pattern.item);
      if (items.length === 0) continue;

      // Apply filter if pattern has one
      if ((pattern as any).filter) {
        const filteredItems = [];
        for (const item of items) {
          if (await (pattern as any).filter(item)) {
            filteredItems.push(item);
          }
        }
        items = filteredItems;
      }

      if (items.length === 0) continue;

      console.log(`  ✓ Found ${items.length} athletes using pattern "${pattern.container}"`);

      for (const item of items) {
        try {
          // Get name
          const nameElement = await item.$(pattern.name);
          const name = await nameElement?.textContent();
          if (!name || name.trim() === '') continue;

          const athlete: AthleteData = {
            name: name.trim(),
          };

          // Get photo URL
          const photoElement = await item.$(pattern.photo);
          if (photoElement) {
            let photoSrc = await photoElement.getAttribute('src');
            if (!photoSrc) photoSrc = await photoElement.getAttribute('data-src');
            if (photoSrc) {
              athlete.photo_url = photoSrc.startsWith('http')
                ? photoSrc
                : new URL(photoSrc, rosterUrl).href;
            }
          }

          // Get position/event (to determine swimmer vs diver)
          const positionElement = await item.$(pattern.position);
          const position = await positionElement?.textContent();
          if (position) {
            const positionLower = position.toLowerCase();
            if (positionLower.includes('div')) {
              athlete.athlete_type = 'diver';
            } else if (positionLower.includes('swim')) {
              athlete.athlete_type = 'swimmer';
            }
          }

          // Get class year
          const yearElement = await item.$(pattern.year);
          const year = await yearElement?.textContent();
          if (year) {
            const yearText = year.trim().toLowerCase();
            if (yearText.match(/freshman|fr|1st/)) athlete.class_year = 'freshman';
            else if (yearText.match(/sophomore|so|2nd/)) athlete.class_year = 'sophomore';
            else if (yearText.match(/junior|jr|3rd/)) athlete.class_year = 'junior';
            else if (yearText.match(/senior|sr|4th|fifth|5th|grad/)) athlete.class_year = 'senior';
          }

          // Get hometown
          const hometownElement = await item.$(pattern.hometown);
          const hometown = await hometownElement?.textContent();
          if (hometown) {
            athlete.hometown = hometown.trim();
          }

          // Get profile URL
          const linkElement = await item.$('a');
          if (linkElement) {
            let href = await linkElement.getAttribute('href');
            if (href) {
              athlete.profile_url = href.startsWith('http')
                ? href
                : new URL(href, rosterUrl).href;
            }
          }

          athletes.push(athlete);
        } catch (error) {
          // Skip individual athletes that fail
          continue;
        }
      }

      // If we found athletes with this pattern, stop trying other patterns
      if (athletes.length > 0) break;
    }

    await browser.close();

    console.log(`  ✅ Found ${athletes.length} athletes`);

    if (athletes.length === 0) {
      console.log(`  ⚠️  No athletes found - may not have men's program or different site structure`);
      return;
    }

    // Insert athletes into database
    const athletesWithTeamId = athletes.map((athlete) => ({
      ...athlete,
      team_id: teamId,
    }));

    const { data, error } = await supabase
      .from('athletes')
      .insert(athletesWithTeamId)
      .select();

    if (error) {
      console.error(`  ❌ Error inserting athletes:`, error);
    } else {
      console.log(`  💾 Inserted ${data?.length}/${athletes.length} athletes into database`);
    }
  } catch (error: any) {
    console.error(`  ❌ Error scraping ${teamName}:`, error.message);
    await browser.close();
  }
}

async function main() {
  console.log('🚀 Starting targeted team re-scraping\n');
  console.log(`📊 Teams to scrape: ${teamsToScrape.map(t => t.name).join(', ')}\n`);

  for (const teamConfig of teamsToScrape) {
    // Get team ID from database
    const { data: team, error } = await supabase
      .from('teams')
      .select('id, name')
      .eq('name', teamConfig.name)
      .single();

    if (error || !team) {
      console.log(`  ❌ Team "${teamConfig.name}" not found in database`);
      console.log(`     Error:`, error);
      continue;
    }

    await scrapeTeam(team.name, teamConfig.url, team.id);
  }

  console.log('\n🎉 Re-scraping complete!');
}

main();
