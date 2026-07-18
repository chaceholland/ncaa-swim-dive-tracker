// Updated background.js with custom handlers for Kentucky, LSU
console.log('=== BACKGROUND SCRIPT LOADED ===');

// Headshots are no longer PATCHed straight into Supabase. Writing with the
// anon key was a silent no-op (RLS: anon is SELECT-only, PostgREST returns 204
// for 0 matched rows). We now POST to the tracker's token-guarded endpoint,
// which holds the service-role key server-side and reports real row counts.
const API_BASE_URL = 'https://ncaa-swim-dive-tracker.vercel.app';
const HEADSHOTS_ENDPOINT = API_BASE_URL + '/api/headshots';

// Shared secret; must equal the server's HEADSHOT_SECRET env var.
// DO NOT commit a real value here. Load it once from the service worker
// console (chrome://extensions -> Inspect views: service worker):
//   chrome.storage.local.set({ headshotSecret: 'the-secret-value' })
const HEADSHOT_SECRET_FALLBACK = '';

async function getHeadshotSecret() {
  try {
    const stored = await chrome.storage.local.get('headshotSecret');
    if (stored && stored.headshotSecret) return stored.headshotSecret;
  } catch (err) {
    console.error('Could not read headshotSecret from storage: ' + err.message);
  }
  return HEADSHOT_SECRET_FALLBACK;
}

const TEAMS = [
  // SEC
  {id: 'alabama', name: 'Alabama', url: 'https://rolltide.com/sports/swimming-and-diving/roster/2025-26'},
  {id: 'auburn', name: 'Auburn', url: 'https://auburntigers.com/sports/swimming-diving/roster'},
  {id: 'florida', name: 'Florida', url: 'https://floridagators.com/sports/mens-swimming-and-diving/roster'},
  {id: 'georgia', name: 'Georgia', url: 'https://georgiadogs.com/sports/swimming-and-diving/roster'},
  {id: 'kentucky', name: 'Kentucky', url: 'https://ukathletics.com/sports/mswim/roster'},
  {id: 'lsu', name: 'LSU', url: 'https://lsusports.net/sports/sd/roster'},
  {id: 'south-carolina', name: 'South Carolina', url: 'https://gamecocksonline.com/sports/swimming/roster'},
  {id: 'tennessee', name: 'Tennessee', url: 'https://utsports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'texas', name: 'Texas', url: 'https://texassports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'texas-am', name: 'Texas A&M', url: 'https://12thman.com/sports/swimdive/roster'},
  
  // Big Ten
  {id: 'indiana', name: 'Indiana', url: 'https://iuhoosiers.com/sports/mens-swimming-and-diving/roster'},
  {id: 'michigan', name: 'Michigan', url: 'https://mgoblue.com/sports/mens-swimming-and-diving/roster'},
  {id: 'minnesota', name: 'Minnesota', url: 'https://gophersports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'northwestern', name: 'Northwestern', url: 'https://nusports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'ohio-state', name: 'Ohio State', url: 'https://ohiostatebuckeyes.com/sports/mens-swimming-and-diving/roster'},
  {id: 'penn-state', name: 'Penn State', url: 'https://gopsusports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'purdue', name: 'Purdue', url: 'https://purduesports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'usc', name: 'USC', url: 'https://usctrojans.com/sports/mens-swimming-and-diving/roster'},
  {id: 'wisconsin', name: 'Wisconsin', url: 'https://uwbadgers.com/sports/mens-swimming-and-diving/roster'},
  
  // ACC
  {id: 'duke', name: 'Duke', url: 'https://goduke.com/sports/mens-swimming-and-diving/roster'},
  {id: 'florida-state', name: 'Florida State', url: 'https://seminoles.com/sports/swimming-and-diving/roster'},
  {id: 'georgia-tech', name: 'Georgia Tech', url: 'https://ramblinwreck.com/sports/swimming-and-diving/roster'},
  {id: 'louisville', name: 'Louisville', url: 'https://gocards.com/sports/mens-swimming-and-diving/roster'},
  {id: 'nc-state', name: 'NC State', url: 'https://gopack.com/sports/swimming-and-diving/roster'},
  {id: 'north-carolina', name: 'North Carolina', url: 'https://goheels.com/sports/mens-swimming-and-diving/roster'},
  {id: 'notre-dame', name: 'Notre Dame', url: 'https://und.com/sports/mens-swimming-and-diving/roster'},
  {id: 'pittsburgh', name: 'Pittsburgh', url: 'https://pittsburghpanthers.com/sports/swimming-and-diving/roster'},
  {id: 'stanford', name: 'Stanford', url: 'https://gostanford.com/sports/mens-swimming-and-diving/roster'},
  {id: 'virginia', name: 'Virginia', url: 'https://virginiasports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'virginia-tech', name: 'Virginia Tech', url: 'https://hokiesports.com/sports/mens-swimming-and-diving/roster'},
  
  // Big 12
  {id: 'arizona', name: 'Arizona', url: 'https://arizonawildcats.com/sports/mens-swimming-and-diving/roster'},
  {id: 'arizona-state', name: 'Arizona State', url: 'https://thesundevils.com/sports/mens-swimming-and-diving/roster'},
  {id: 'tcu', name: 'TCU', url: 'https://gofrogs.com/sports/mens-swimming-and-diving/roster'},
  {id: 'utah', name: 'Utah', url: 'https://utahutes.com/sports/swimming-and-diving/roster'},
  {id: 'west-virginia', name: 'West Virginia', url: 'https://wvusports.com/sports/swimming-and-diving/roster'},
  
  // Ivy League
  {id: 'brown', name: 'Brown', url: 'https://brownbears.com/sports/mens-swimming-and-diving/roster'},
  {id: 'columbia', name: 'Columbia', url: 'https://gocolumbialions.com/sports/mens-swimming-and-diving/roster'},
  {id: 'cornell', name: 'Cornell', url: 'https://cornellbigred.com/sports/mens-swimming-and-diving/roster'},
  {id: 'dartmouth', name: 'Dartmouth', url: 'https://dartmouthsports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'harvard', name: 'Harvard', url: 'https://gocrimson.com/sports/mens-swimming-and-diving/roster'},
  {id: 'penn', name: 'Penn', url: 'https://pennathletics.com/sports/mens-swimming-and-diving/roster'},
  {id: 'princeton', name: 'Princeton', url: 'https://goprincetontigers.com/sports/mens-swimming-and-diving/roster'},
  {id: 'yale', name: 'Yale', url: 'https://yalebulldogs.com/sports/mens-swimming-and-diving/roster'},
  
  // Service Academies
  {id: 'army', name: 'Army', url: 'https://goarmywestpoint.com/sports/mens-swimming-and-diving/roster'},
  {id: 'navy', name: 'Navy', url: 'https://navysports.com/sports/mens-swimming-and-diving/roster'},
  {id: 'air-force', name: 'Air Force', url: 'https://goairforcefalcons.com/sports/mens-swimming-and-diving/roster'},
  
  // Mid-Majors
  {id: 'cincinnati', name: 'Cincinnati', url: 'https://gobearcats.com/sports/mens-swimming-and-diving/roster'},
  {id: 'denver', name: 'Denver', url: 'https://denverpioneers.com/sports/mens-swimming-and-diving/roster'},
  {id: 'grand-canyon', name: 'Grand Canyon', url: 'https://gculopes.com/sports/mens-swimming-and-diving/roster'},
  {id: 'umbc', name: 'UMBC', url: 'https://umbcretrievers.com/sports/mens-swimming-and-diving/roster'},
  {id: 'njit', name: 'NJIT', url: 'https://njithighlanders.com/sports/mens-swimming-and-diving/roster'},
];

console.log('Teams configured:', TEAMS.length);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('MESSAGE RECEIVED:', request);
  if (request.action === 'scrapeAllTeams') {
    console.log('STARTING SCRAPE...');
    scrapeAllTeams();
    sendResponse({status: 'started'});
  }
  return true;
});

console.log('Message listener registered');

async function scrapeAllTeams() {
  console.log('=== CSD HEADSHOT SCRAPER STARTED ===');
  console.log('Processing ' + TEAMS.length + ' teams...');

  const secret = await getHeadshotSecret();
  if (!secret) {
    console.error('NO SECRET CONFIGURED — scrape will run but nothing will be saved.');
    console.error('Run: chrome.storage.local.set({ headshotSecret: "..." }) and retry.');
  }

  for (let i = 0; i < TEAMS.length; i++) {
    const team = TEAMS[i];
    console.log('\n[' + (i+1) + '/' + TEAMS.length + '] Processing: ' + team.name);
    console.log('URL: ' + team.url);
    
    try {
      const tab = await chrome.tabs.create({ url: team.url, active: false });
      console.log('Tab created: ' + tab.id);
      
      await new Promise(resolve => {
        const listener = (tabId, info) => {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            console.log('Page loaded, waiting 3s for JavaScript...');
            setTimeout(resolve, 3000);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      
      console.log('Extracting athlete data...');
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractAthletes
      });
      
      const data = result.result || { athletes: [], debug: {} };
      const athletes = data.athletes || [];
      const debug = data.debug || {};
      
      console.log('DEBUG INFO:');
      console.log('  Page title:', debug.title);
      console.log('  Ready state:', debug.readyState);
      console.log('  .sidearm-roster-player:', debug.sidearmCount);
      console.log('  .roster-card:', debug.rosterCardCount);
      console.log('  li[class*="roster"]:', debug.liRosterCount);
      console.log('  .s-person-card:', debug.personCardCount);
      console.log('  a[href*="/roster/player/"]:', debug.ukCardCount);
      console.log('  .sqs-row:', debug.lsuCardCount);
      console.log('  Sample classes:', debug.sampleClasses);
      
      const withPhotos = athletes.filter(a => a.headshot).length;
      console.log('Found ' + athletes.length + ' athletes, ' + withPhotos + ' with photos');
      
      if (athletes.length > 0) {
        console.log('Sample athletes:');
        for (let j = 0; j < Math.min(3, athletes.length); j++) {
          const a = athletes[j];
          console.log('  - ' + a.name + ': ' + (a.headshot ? 'HAS PHOTO' : 'NO PHOTO'));
        }
      }
      
      console.log('Updating database...');
      const updates = [];
      for (const athlete of athletes) {
        if (athlete.headshot) {
          updates.push({ name: athlete.name, photo_url: athlete.headshot });
        }
      }

      if (updates.length === 0) {
        console.log('No headshots scraped for ' + team.name + ' - nothing to send');
      } else if (!secret) {
        console.error('SKIPPED ' + updates.length + ' headshots - no headshotSecret configured');
      } else {
        try {
          const response = await fetch(HEADSHOTS_ENDPOINT, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + secret,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ team: team.id, updates: updates })
          });

          let body = null;
          try { body = await response.json(); } catch { body = null; }

          if (!response.ok) {
            // 401 = wrong/missing secret, 404 = slug not in `teams`.
            console.error('  UPLOAD FAILED - Status: ' + response.status);
            console.error('  Response: ' + JSON.stringify(body));
          } else {
            // Real row counts from the DB, not just "the request succeeded".
            console.log('  Sent ' + updates.length + ' of ' + withPhotos +
              ' | matched ' + body.matched + ' | updated ' + body.updated);
            if (body.unmatched && body.unmatched.length > 0) {
              console.warn('  NO DB MATCH (' + body.unmatched.length + '): ' +
                body.unmatched.join(', '));
            }
            if (body.errors && body.errors.length > 0) {
              console.error('  ROW ERRORS (' + body.errors.length + '): ' +
                JSON.stringify(body.errors));
            }
            if (body.updated === 0) {
              console.error('  WARNING: 0 rows updated for ' + team.name);
            }
          }
        } catch (err) {
          console.error('  UPLOAD ERROR: ' + err.message);
        }
      }

      await chrome.tabs.remove(tab.id);
      console.log('Tab closed');
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error('ERROR processing ' + team.name + ':', err);
    }
  }
  console.log('\n=== SCRAPING COMPLETE ===');
}

function extractAthletes() {
  const debug = {
    title: document.title,
    readyState: document.readyState,
    sidearmCount: document.querySelectorAll('.sidearm-roster-player').length,
    rosterCardCount: document.querySelectorAll('.roster-card').length,
    liRosterCount: document.querySelectorAll('li[class*="roster"]').length,
    personCardCount: document.querySelectorAll('.s-person-card').length,
    ukCardCount: document.querySelectorAll('a[href*="/roster/player/"]').length,
    lsuCardCount: document.querySelectorAll('.sqs-row').length,
    sampleClasses: ''
  };
  
  const elements = document.querySelectorAll('[class]');
  const classes = Array.from(elements).slice(0, 20).map(el => el.className).join(' ');
  debug.sampleClasses = classes.substring(0, 200);
  
  const athletes = [];
  
  // KENTUCKY: Special handler for UK Athletics
  if (window.location.hostname === 'ukathletics.com') {
    const ukCards = document.querySelectorAll('a[href*="/roster/player/"]');
    ukCards.forEach((card) => {
      const nameEl = card.querySelector('h3');
      const imgEl = card.querySelector('img');
      
      if (nameEl) {
        const name = nameEl.textContent.trim();
        let headshot = null;
        
        if (imgEl) {
          headshot = imgEl.src || imgEl.dataset.src;
          const bad = ['placeholder', 'default', 'silhouette', 'avatar', 'blank'];
          if (headshot && bad.some(b => headshot.toLowerCase().includes(b))) {
            headshot = null;
          }
        }
        
        if (name) {
          athletes.push({ name, headshot });
        }
      }
    });
    return { athletes, debug };
  }
  
  // LSU: Special handler - uses similar structure to UK
  if (window.location.hostname === 'lsusports.net') {
    let lsuCards = document.querySelectorAll('a[href*="/roster/player/"]');
    
    if (lsuCards.length === 0) {
      lsuCards = document.querySelectorAll('.sqs-row, .roster-player, .athlete-card');
    }
    
    lsuCards.forEach((card) => {
      const nameEl = card.querySelector('h3, h4, h2, p strong, .name, [class*="name"]');
      let imgEl = card.querySelector('img');
      
      // If no img inside card, check parent or siblings
      if (!imgEl && card.parentElement) {
        imgEl = card.parentElement.querySelector('img');
      }
      
      if (nameEl) {
        const name = nameEl.textContent.trim();
        let headshot = null;
        
        if (imgEl) {
          headshot = imgEl.src || imgEl.dataset.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-image');
          const bad = ['placeholder', 'default', 'silhouette', 'avatar', 'blank'];
          if (headshot && bad.some(b => headshot.toLowerCase().includes(b))) {
            headshot = null;
          }
        }
        
        // Accept with or without headshot (like Kentucky handler)
        if (name) {
          athletes.push({ name, headshot });
        }
      }
    });
    return { athletes, debug };
  }
  
  // Try standard selectors for other sites
  let players = document.querySelectorAll('.sidearm-roster-player');
  if (players.length === 0) {
    players = document.querySelectorAll('.roster-card');
  }
  if (players.length === 0) {
    players = document.querySelectorAll('li[class*="roster"]');
  }
  if (players.length === 0) {
    players = document.querySelectorAll('.s-person-card');
  }
  
  players.forEach((player) => {
    const nameEl = player.querySelector('.sidearm-roster-player-name') ||
                  player.querySelector('[class*="name"]') ||
                  player.querySelector('h3, h4, h2') ||
                  player.querySelector('a');
    
    if (nameEl) {
      const name = nameEl.textContent.trim();
      const imgEl = player.querySelector('img');
      let headshot = null;
      
      if (imgEl) {
        headshot = imgEl.src || imgEl.dataset.src || imgEl.getAttribute('data-src');
        const bad = ['placeholder', 'default', 'silhouette', 'avatar', 'blank'];
        if (headshot && bad.some(b => headshot.toLowerCase().includes(b))) {
          headshot = null;
        }
      }
      
      if (name) {
        athletes.push({ name, headshot });
      }
    }
  });
  
  return { athletes, debug };
}
