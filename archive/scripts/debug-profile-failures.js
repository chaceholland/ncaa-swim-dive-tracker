require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TEAMS = [
  { name: 'Georgia Tech',   rosterUrl: 'https://ramblinwreck.com/sports/c-swim/roster',                  host: 'ramblinwreck.com' },
  { name: 'South Carolina', rosterUrl: 'https://gamecocksonline.com/sports/swimming/roster',              host: 'gamecocksonline.com' },
  { name: 'Virginia',       rosterUrl: 'https://virginiasports.com/sports/swimming/roster',               host: 'virginiasports.com' },
  { name: 'Virginia Tech',  rosterUrl: 'https://hokiesports.com/sports/swimming-diving/roster',           host: 'hokiesports.com' },
];

async function main() {
  // Delete Notre Dame coaches
  const coachIds = [
    'cf80bf44-e073-47c4-b153-68353a6ea594', // Michael Norment
    '52c19c2b-247d-4598-a75b-ac18a4751417', // Max McHugh
    '1de11a76-25b8-4b8f-b9b8-c616dd6741f1', // Trevor Carroll
    '58a276c1-6667-4b37-9717-40fe09accfe3', // Josh Arndt
  ];
  const { error } = await supabase.from('athletes').delete().in('id', coachIds);
  console.log('Deleted Notre Dame coaches:', error ? error.message : '✅ 4 deleted');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const team of TEAMS) {
    console.log('\n=== ' + team.name + ' ===');
    const { data: teamRow } = await supabase.from('teams').select('id').eq('name', team.name).single();
    const { data: athletes } = await supabase.from('athletes').select('id, name, profile_url').eq('team_id', teamRow.id);
    console.log('DB athletes:', athletes.map(a => a.name).join(', '));

    await page.goto(team.rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const links = await page.evaluate((host) => {
      const seen = new Set();
      const results = [];
      document.querySelectorAll('a').forEach(a => {
        const href = a.href || '';
        const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
        if (!href.includes(host)) return;
        if (seen.has(href)) return;
        if (href.includes('/coaches/') || href.includes('#')) return;
        seen.add(href);
        results.push({ href, text: text.slice(0, 50) });
      });
      return results.slice(0, 80);
    }, team.host);

    console.log('All roster links (' + links.length + '):');
    links.forEach(l => console.log('  [' + l.text + '] -> ' + l.href.split(team.host)[1]));
  }

  await browser.close();
}
main().catch(console.error);
