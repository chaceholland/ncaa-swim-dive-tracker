/**
 * Verify correct SwimCloud IDs and understand meet structure
 */
const { chromium } = require("playwright");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function checkTeam(page, id) {
  const url = `https://www.swimcloud.com/team/${id}/`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(300);
  const h1 = await page.evaluate(
    () => document.querySelector("h1")?.textContent?.trim() || document.title,
  );
  return h1;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    // Verify known IDs from the database
    const idsToCheck = {
      auburn: "88",
      indiana: "92",
      michigan: "89",
      tennessee: "127",
      "ohio-state": "97",
      usc: "135",
      wisconsin: "143",
      louisville: "75",
      alabama: "86",
      minnesota: "90",
      "notre-dame": "96",
      "arizona-state": "87",
      florida: "117",
      georgia: "124",
      texas: "105",
      "texas-am": "126",
      "penn-state": "104",
      stanford: "112",
      "nc-state": "394",
      uva: "73",
      arizona: "85",
      utah: "131",
      cal: "111",
    };

    console.log("Verifying team IDs...\n");
    for (const [teamSlug, id] of Object.entries(idsToCheck)) {
      const name = await checkTeam(page, id);
      console.log(`${teamSlug} (ID ${id}): ${name}`);
    }

    // Now look at the team/results page to understand what meet links look like
    console.log("\n\n=== Checking team results page for Ohio State (97) ===");
    await page.goto("https://www.swimcloud.com/team/97/results/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const resultsInfo = await page.evaluate(() => {
      return {
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.trim(),
        meetLinks: Array.from(document.querySelectorAll('a[href*="/results/"]'))
          .map((a) => ({
            href: a.href,
            text: a.textContent.trim().replace(/\s+/g, " ").substring(0, 100),
          }))
          .filter((l) => l.href.match(/\/results\/\d+/))
          .slice(0, 15),
      };
    });

    console.log(JSON.stringify(resultsInfo, null, 2));

    // Load a specific meet to understand event structure better
    console.log("\n\n=== Checking B1G Champs meet structure ===");
    await page.goto("https://www.swimcloud.com/results/370136/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const meetStructure = await page.evaluate(() => {
      // Find the event navigation (list of events)
      const eventLinks = [];
      const seenEvents = new Set();

      document.querySelectorAll('a[href*="/event/"]').forEach((a) => {
        const match = a.href.match(/\/results\/(\d+)\/event\/(\d+)\//);
        if (match && !seenEvents.has(match[2])) {
          seenEvents.add(match[2]);
          eventLinks.push({
            href: a.href.split("?")[0],
            meetId: match[1],
            eventId: match[2],
            text: a.textContent.trim(),
          });
        }
      });

      // Get meet metadata
      const metaElems = document.querySelectorAll(
        '[class*="meet-info"], .meet-header, .c-results-header',
      );
      const dateText = Array.from(
        document.querySelectorAll('time, [class*="date"], [datetime]'),
      )
        .map((el) => el.textContent.trim())
        .filter((t) => t)
        .slice(0, 5);

      // Get table structure for first event preview
      const tableRows = Array.from(
        document.querySelectorAll("table tbody tr, .c-table tbody tr"),
      ).slice(0, 3);
      const sampleRows = tableRows.map((row) => ({
        cells: Array.from(row.querySelectorAll("td")).map((td) =>
          td.textContent.trim(),
        ),
        swimmerLink: row.querySelector('a[href*="/swimmer/"]')?.href,
        eventLink: row.querySelector('a[href*="/event/"]')?.href,
      }));

      return {
        title: document.title,
        uniqueEvents: eventLinks.slice(0, 20),
        dateText,
        sampleRows,
      };
    });

    console.log("Meet structure:");
    console.log(JSON.stringify(meetStructure, null, 2));

    // Load one event page to see row structure
    if (meetStructure.uniqueEvents.length > 0) {
      const eventUrl = meetStructure.uniqueEvents[0].href;
      console.log(`\n\n=== Loading event page: ${eventUrl} ===`);
      await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const eventData = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll("table tbody tr"));

        return {
          title: document.title,
          rowCount: rows.length,
          sampleRows: rows.slice(0, 5).map((row) => ({
            html: row.innerHTML.substring(0, 600),
            cells: Array.from(row.querySelectorAll("td")).map((td) => ({
              text: td.textContent.trim(),
              class: td.className,
            })),
            swimmerLinks: Array.from(
              row.querySelectorAll('a[href*="/swimmer/"]'),
            ).map((a) => ({
              href: a.href,
              text: a.textContent.trim(),
            })),
            timeLinks: Array.from(
              row.querySelectorAll('a[href*="/event/"]'),
            ).map((a) => ({
              href: a.href,
              text: a.textContent.trim(),
            })),
          })),
        };
      });

      console.log("Event page data:");
      console.log(JSON.stringify(eventData, null, 2));
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
