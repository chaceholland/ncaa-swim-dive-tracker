// Read-only DOM probe for SwimCloud event result pages.
// Goal: understand how prelims vs finals are separated, and how relay squads /
// legs are laid out, so import-ncaa-champs-2026.mjs can be reworked to capture
// rounds + relay results correctly. Writes NOTHING to any DB.
//
//   node scripts/staging/inspect-event-dom.mjs [--meet-id=351190]
//
// Launches headed real Chrome (same stealth config as the import) so you can
// solve the Cloudflare check once; cf_clearance persists for the whole session.

import { chromium } from "playwright";

const MEET_ID =
  (process.argv.find((x) => x.startsWith("--meet-id=")) || "").split("=")[1] ||
  "351190";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clearChallenge(page, selector, maxMs = 180000) {
  const deadline = Date.now() + maxMs;
  let lastReload = Date.now();
  while (Date.now() < deadline) {
    if (await page.$(selector)) return true;
    const title = await page.title().catch(() => "");
    if (
      /just a moment|security verification|verify you are human/i.test(title) &&
      Date.now() - lastReload > 30000
    ) {
      lastReload = Date.now();
      await page
        .reload({ waitUntil: "domcontentloaded", timeout: 45000 })
        .catch(() => {});
    }
    await sleep(2500);
  }
  return !!(await page.$(selector));
}

// Dump the structural skeleton of whatever results UI the page is using.
function probe() {
  const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

  // Anything that looks like a round selector (tabs / buttons / dropdown).
  const roundControls = [];
  for (const el of document.querySelectorAll(
    '[role="tab"], .nav-tabs a, .nav-tabs button, button, select option, a[href*="round"], a[href*="phase"]',
  )) {
    const t = txt(el);
    if (/prelim|final|swim.?off|time.?trial|round|phase/i.test(t)) {
      roundControls.push({ tag: el.tagName, text: t.slice(0, 40) });
    }
  }

  // Every table: what heading precedes it, its header cells, row count, samples.
  const tables = Array.from(document.querySelectorAll("table")).map(
    (tbl, i) => {
      // nearest preceding heading-ish element
      let heading = null;
      let n = tbl;
      for (let hops = 0; hops < 6 && n; hops++) {
        n = n.previousElementSibling || n.parentElement;
        if (!n) break;
        const h = n.matches?.(
          "h1,h2,h3,h4,h5,.h1,.h2,.h3,.c-title,caption,legend",
        )
          ? n
          : n.querySelector?.("h1,h2,h3,h4,h5,caption,legend");
        if (h && txt(h)) {
          heading = txt(h).slice(0, 60);
          break;
        }
      }
      const ths = Array.from(tbl.querySelectorAll("thead th, thead td")).map(
        (c) => txt(c).slice(0, 24),
      );
      const bodyRows = Array.from(tbl.querySelectorAll("tbody tr"));
      const sample = bodyRows.slice(0, 3).map((r) =>
        Array.from(r.querySelectorAll("td")).map((c) => {
          const link = c.querySelector("a[href]");
          return {
            text: txt(c).slice(0, 24),
            href: link ? link.getAttribute("href") : null,
          };
        }),
      );
      return {
        tableIndex: i,
        precedingHeading: heading,
        headerCells: ths,
        bodyRowCount: bodyRows.length,
        caption: txt(tbl.querySelector("caption")) || null,
        sampleRows: sample,
      };
    },
  );

  return {
    title: document.title,
    h1: txt(document.querySelector("h1")),
    roundControls,
    tableCount: tables.length,
    tables,
  };
}

async function main() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();

  console.log(
    `Loading meet ${MEET_ID} — solve Cloudflare once in the Chrome window…`,
  );
  await page.goto(`https://www.swimcloud.com/results/${MEET_ID}/`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await clearChallenge(page, 'a[href*="/event/"]');
  await sleep(800);

  const events = await page.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/event/"]')) {
      const m = a.href.match(/\/results\/(\d+)\/event\/(\d+)\//);
      if (m && !seen.has(m[2])) {
        seen.add(m[2]);
        out.push({
          eventId: m[2],
          url: `https://www.swimcloud.com/results/${m[1]}/event/${m[2]}/`,
          name: a.textContent.replace(/\s+/g, " ").trim().slice(0, 60),
        });
      }
    }
    return out;
  });

  // Target explicit event ids (link text on the meet page is unreliable — some
  // events render the winning time as the link label). event 10 = 100 Back,
  // event 6 = 200 Free (both individual, both known to have prelim/final dupes).
  const wanted = [
    ["INDIVIDUAL (event 10 / 100 Back)", "10"],
    ["INDIVIDUAL (event 6 / 200 Free)", "6"],
  ];

  for (const [label, eid] of wanted) {
    const url = `https://www.swimcloud.com/results/${MEET_ID}/event/${eid}/`;
    console.log(`\n${"=".repeat(70)}\n${label}: ${url}\n${"=".repeat(70)}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await clearChallenge(page, "table tbody tr");
    await sleep(500);
    const info = await page.evaluate(probe);
    console.log(JSON.stringify(info, null, 2));
  }

  await browser.close();
  console.log("\nProbe complete. No writes performed.");
}

main().catch((e) => {
  console.error("probe failed:", e.message);
  process.exit(1);
});
