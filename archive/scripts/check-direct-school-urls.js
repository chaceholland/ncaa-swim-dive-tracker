require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: athletes } = await supabase
    .from('athletes')
    .select('name, photo_url, teams!inner(name)')
    .not('photo_url', 'is', null)
    .limit(2000);

  const directUrls = athletes.filter(a => {
    const url = a.photo_url;
    return url &&
           url.startsWith('http') &&
           !url.includes('/render/image/') &&
           !url.includes('sidearmdev.com') &&
           !url.includes('cloudfront.net') &&
           !url.includes('/imgproxy/') &&
           !url.includes('storage.googleapis.com');
  });

  console.log(`\nFound ${directUrls.length} athletes with direct school URLs\n`);

  // Group by domain
  const domains = {};
  directUrls.forEach(a => {
    try {
      const url = new URL(a.photo_url);
      const domain = url.hostname;
      if (!domains[domain]) {
        domains[domain] = [];
      }
      domains[domain].push({ name: a.name, team: a.teams.name, url: a.photo_url.substring(0, 100) });
    } catch (e) {
      // ignore
    }
  });

  // Show top domains
  const sorted = Object.entries(domains).sort((a, b) => b[1].length - a[1].length);

  sorted.slice(0, 15).forEach(([domain, athletes]) => {
    console.log(`\n${domain} (${athletes.length} athletes)`);
    console.log(`  Example: ${athletes[0].team} - ${athletes[0].name}`);
    console.log(`  URL: ${athletes[0].url}`);
  });
}

main();
