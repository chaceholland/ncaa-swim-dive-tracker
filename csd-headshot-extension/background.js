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

      // Which extraction scope was used, so a run is auditable per team.
      // The selector counts above are whole-page; these are the scoped ones.
      console.log('  SCOPE: ' + debug.scopeMode + ' (' + debug.scopeStrategy + ')' +
        (debug.scopeHeading ? ' via "' + debug.scopeHeading + '"' : ''));
      console.log('  Roster headings - mens: ' + debug.mensHeadings +
        ', womens: ' + debug.womensHeadings);
      console.log('  Cards in scope: ' + debug.scopedCardCount +
        ' | skipped as womens-roster: ' + debug.skippedWomens);
      if (debug.mensHeadings > 0 && debug.womensHeadings > 0 &&
          debug.scopeMode === 'whole page') {
        console.warn('  Combined page but scoping fell back to whole page - ' +
          'relying on the womens-section safety net only. Check this team.');
      }

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
  // NOTE: this function is stringified and injected by chrome.scripting, so it
  // cannot reference anything from the service-worker scope. Every helper it
  // uses has to be declared inside it.

  // These counts are deliberately WHOLE-PAGE, so a run can be compared against
  // the men's-scoped counts further down and the scoping can be audited.
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

  // -------------------------------------------------------------------------
  // MEN'S-ROSTER SCOPING
  //
  // Many school roster pages are COMBINED: one document renders "Women's
  // Roster", then "Men's Roster", then coaching / support staff. Scraping the
  // whole page pulls women's cards into a men-only tracker, and a surname
  // collision then attaches the wrong photo to the right athlete (Auburn's
  // "Hanna Schmidt" landing on "Danny Schmidt" is the confirmed case).
  //
  // If the page has BOTH a men's and a women's roster heading, restrict the
  // search to the men's subtree. If it has only one (or neither), keep the old
  // whole-page behavior — most configured URLs are already men's-only.
  // -------------------------------------------------------------------------
  const HEADING_SELECTOR = 'h1, h2, h3, h4, [class*="section-title"], ' +
    '[class*="sectionTitle"], [class*="section_title"], [class*="roster-title"], ' +
    '[class*="rosterTitle"]';

  // Union of every per-site card selector used below; used to test whether a
  // candidate scope actually contains a roster before committing to it.
  const CARD_PROBE = '.sidearm-roster-player, .roster-card, li[class*="roster"], ' +
    '.s-person-card, a[href*="/roster/player/"], .sqs-row';

  // The \b before "men" is what keeps /men's roster/ from matching the tail of
  // "women's roster" — o and m are both word chars, so there is no boundary.
  const MENS_RE = /\bmen'?s[\s\S]{0,40}?\brosters?\b/i;
  const WOMENS_RE = /\bwomen'?s[\s\S]{0,40}?\brosters?\b/i;
  const STAFF_RE = /\b(coaching\s+staff|support\s+staff|coaches|staff|managers?)\b/i;

  function normText(el) {
    const raw = el.textContent || '';
    return raw.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
  }

  function headingLevel(el) {
    const m = /^H([1-6])$/.exec(el.tagName);
    return m ? parseInt(m[1], 10) : 99;
  }

  // Classify every section heading on the page, in document order.
  const headings = [];
  const headingEls = document.querySelectorAll(HEADING_SELECTOR);
  for (let i = 0; i < headingEls.length; i++) {
    const el = headingEls[i];
    if (el.closest('nav, select, option')) continue;
    const text = normText(el);
    if (!text || text.length > 120) continue;
    const isMen = MENS_RE.test(text);
    const isWomen = WOMENS_RE.test(text);
    let kind = null;
    if (isMen && !isWomen) kind = 'men';
    else if (isWomen && !isMen) kind = 'women';
    // A single "Men's & Women's Roster" heading is ambiguous, not a boundary:
    // leave it unclassified so the page falls back to whole-page mode.
    else if (!isMen && !isWomen && STAFF_RE.test(text)) kind = 'staff';
    if (kind) headings.push({ el: el, kind: kind, text: text });
  }

  const mensHeadings = headings.filter(h => h.kind === 'men');
  const womensHeadings = headings.filter(h => h.kind === 'women');
  const combined = mensHeadings.length > 0 && womensHeadings.length > 0;

  function queryScoped(roots, selector) {
    const out = [];
    const seen = new Set();
    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      if (root.nodeType === 1 && root.matches(selector) && !seen.has(root)) {
        seen.add(root);
        out.push(root);
      }
      const found = root.querySelectorAll(selector);
      for (let j = 0; j < found.length; j++) {
        if (!seen.has(found[j])) {
          seen.add(found[j]);
          out.push(found[j]);
        }
      }
    }
    return out;
  }

  // True if `node` is, or wraps, a heading that ends the men's section.
  function containsBoundary(node, mensEl) {
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      if (h.el === mensEl || h.kind === 'men') continue;
      if (node === h.el || node.contains(h.el)) return true;
    }
    return false;
  }

  function scopeForHeading(mensEl) {
    // (a) Nested markup: climb to the widest ancestor that still excludes every
    //     women's / staff heading. That ancestor is the men's section.
    let anchor = mensEl;
    while (anchor.parentElement &&
           anchor.parentElement !== document.body &&
           anchor.parentElement !== document.documentElement &&
           !containsBoundary(anchor.parentElement, mensEl)) {
      anchor = anchor.parentElement;
    }
    if (anchor !== mensEl && queryScoped([anchor], CARD_PROBE).length > 0) {
      return { roots: [anchor], strategy: 'containing section' };
    }

    // (b) Flat markup: walk siblings from the heading until the next section
    //     heading — women's, staff, or any heading of the same/higher level.
    const mensLevel = headingLevel(mensEl);
    const roots = [];
    let node = anchor.nextElementSibling;
    while (node) {
      if (containsBoundary(node, mensEl)) break;
      if (mensLevel <= 6 && headingLevel(node) <= mensLevel) break;
      roots.push(node);
      node = node.nextElementSibling;
    }
    if (roots.length > 0 && queryScoped(roots, CARD_PROBE).length > 0) {
      return { roots: roots, strategy: 'sibling walk' };
    }
    return null;
  }

  let scopeRoots = null;
  let scopeStrategy = 'n/a';
  let scopeHeading = '';
  if (combined) {
    for (let i = 0; i < mensHeadings.length && !scopeRoots; i++) {
      const found = scopeForHeading(mensHeadings[i].el);
      if (found) {
        scopeRoots = found.roots;
        scopeStrategy = found.strategy;
        scopeHeading = mensHeadings[i].text;
      }
    }
  }
  const roots = scopeRoots || [document];

  debug.mensHeadings = mensHeadings.length;
  debug.womensHeadings = womensHeadings.length;
  debug.scopeMode = scopeRoots ? "men's section scoped" : 'whole page';
  debug.scopeStrategy = scopeStrategy;
  debug.scopeHeading = scopeHeading;
  debug.scopeRootCount = roots.length;
  debug.scopedCardCount = queryScoped(roots, CARD_PROBE).length;
  debug.skippedWomens = 0;

  // Safety net: even if scoping picked the wrong subtree (or fell back to the
  // whole page), never accept a card that sits in the women's section. Only
  // armed on genuinely combined pages, so a men's-only URL can never be
  // filtered down to zero by it.
  let skippedWomens = 0;

  function inWomensSection(el) {
    if (!combined) return false;

    // (a) Nearest gendered heading preceding the card in document order.
    let kind = null;
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      if (h.kind === 'staff' || h.el === el) continue;
      const pos = h.el.compareDocumentPosition(el);
      // headings[] is in document order, so once one stops preceding the card,
      // none of the later ones can either.
      if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) break;
      kind = h.kind;
    }
    if (kind === 'women') return true;

    // (b) An explicitly women-labelled container (SIDEARM tab panes, etc.).
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 12) {
      const cls = typeof node.className === 'string' ? node.className : '';
      if (/wom[ae]n/i.test((node.id || '') + ' ' + cls)) return true;
      node = node.parentElement;
      depth++;
    }
    return false;
  }

  function keepCard(card) {
    if (inWomensSection(card)) {
      skippedWomens++;
      return false;
    }
    return true;
  }

  function finish(list) {
    debug.skippedWomens = skippedWomens;
    debug.athleteCount = list.length;
    return { athletes: list, debug: debug };
  }

  const athletes = [];

  // KENTUCKY: Special handler for UK Athletics
  if (window.location.hostname === 'ukathletics.com') {
    const ukCards = queryScoped(roots, 'a[href*="/roster/player/"]').filter(keepCard);
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
    return finish(athletes);
  }

  // LSU: Special handler - uses similar structure to UK
  if (window.location.hostname === 'lsusports.net') {
    let lsuCards = queryScoped(roots, 'a[href*="/roster/player/"]');

    if (lsuCards.length === 0) {
      lsuCards = queryScoped(roots, '.sqs-row, .roster-player, .athlete-card');
    }

    lsuCards = lsuCards.filter(keepCard);

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
    return finish(athletes);
  }

  // Try standard selectors for other sites
  let players = queryScoped(roots, '.sidearm-roster-player');
  if (players.length === 0) {
    players = queryScoped(roots, '.roster-card');
  }
  if (players.length === 0) {
    players = queryScoped(roots, 'li[class*="roster"]');
  }
  if (players.length === 0) {
    players = queryScoped(roots, '.s-person-card');
  }

  players = players.filter(keepCard);

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

  return finish(athletes);
}
