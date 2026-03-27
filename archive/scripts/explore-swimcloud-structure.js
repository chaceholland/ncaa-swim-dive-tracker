/**
 * Explore SwimCloud structure for a known team (Ohio State, ID=97)
 * to understand HTML structure before building the scraper.
 */
const { chromium } = require("playwright");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    // Explore meets page for Ohio State (ID=97) season 25
    const meetsUrl = "https://www.swimcloud.com/team/97/meets/?season=25";
    console.log(`\n=== Loading: ${meetsUrl} ===`);
    await page.goto(meetsUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const meetsInfo = await page.evaluate(() => {
      // Find meet/results links
      const resultLinks = Array.from(
        document.querySelectorAll('a[href*="/results/"]'),
      );
      const meetLinks = Array.from(
        document.querySelectorAll('a[href*="/meet/"]'),
      );

      return {
        title: document.title,
        resultLinks: resultLinks
          .slice(0, 10)
          .map((a) => ({ href: a.href, text: a.textContent.trim() })),
        meetLinks: meetLinks
          .slice(0, 10)
          .map((a) => ({ href: a.href, text: a.textContent.trim() })),
        allLinks: Array.from(document.querySelectorAll("a"))
          .filter((a) => {
            const href = a.href || "";
            return href.includes("/results/") || href.includes("/meet/");
          })
          .slice(0, 20)
          .map((a) => ({ href: a.href, text: a.textContent.trim() })),
        h1s: Array.from(document.querySelectorAll("h1, h2, h3"))
          .slice(0, 10)
          .map((el) => el.textContent.trim()),
        // Check for any table rows
        rows: document.querySelectorAll("table tr").length,
        // Check for any list items
        listItems: document.querySelectorAll("ul li").length,
      };
    });

    console.log("Meets page info:");
    console.log(JSON.stringify(meetsInfo, null, 2));

    // Try to find a meet results page
    if (meetsInfo.allLinks.length > 0) {
      const firstMeet = meetsInfo.allLinks[0];
      console.log(`\n=== Loading meet results: ${firstMeet.href} ===`);
      await page.goto(firstMeet.href, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      const meetInfo = await page.evaluate(() => {
        const eventLinks = Array.from(
          document.querySelectorAll('a[href*="/event/"]'),
        );
        const resultLinks = Array.from(
          document.querySelectorAll('a[href*="/results/"]'),
        );

        return {
          title: document.title,
          url: window.location.href,
          eventLinks: eventLinks
            .slice(0, 10)
            .map((a) => ({ href: a.href, text: a.textContent.trim() })),
          resultLinks: resultLinks
            .slice(0, 10)
            .map((a) => ({ href: a.href, text: a.textContent.trim() })),
          h1s: Array.from(document.querySelectorAll("h1, h2, h3"))
            .slice(0, 10)
            .map((el) => el.textContent.trim()),
          tableRows: document.querySelectorAll("table tr").length,
        };
      });
      console.log("Meet results page:");
      console.log(JSON.stringify(meetInfo, null, 2));

      // Try to find event links
      if (meetInfo.eventLinks.length > 0) {
        const firstEvent = meetInfo.eventLinks[0];
        console.log(`\n=== Loading event: ${firstEvent.href} ===`);
        await page.goto(firstEvent.href, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        await page.waitForTimeout(2000);

        const eventInfo = await page.evaluate(() => {
          // Look for athlete data
          const swimmerLinks = Array.from(
            document.querySelectorAll('a[href*="/swimmer/"]'),
          );
          const tableRows = Array.from(
            document.querySelectorAll("table tbody tr, .c-table__row"),
          );

          return {
            title: document.title,
            url: window.location.href,
            swimmerLinks: swimmerLinks.slice(0, 5).map((a) => ({
              href: a.href,
              text: a.textContent.trim(),
            })),
            tableRowCount: tableRows.length,
            sampleRow: tableRows[0]?.innerHTML?.trim().substring(0, 500),
            // Try to get all results
            results: tableRows.slice(0, 5).map((row) => {
              const cells = Array.from(
                row.querySelectorAll("td, .c-table__cell"),
              );
              return cells.map((c) => c.textContent.trim()).filter((t) => t);
            }),
          };
        });
        console.log("Event page:");
        console.log(JSON.stringify(eventInfo, null, 2));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
