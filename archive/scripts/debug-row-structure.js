const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await page.goto(
    "https://navysports.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "networkidle", timeout: 30000 },
  );
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const classCell = document.querySelector("td.roster_class");
    if (!classCell) return { error: "no td.roster_class" };
    const row = classCell.closest("tr");
    if (!row) return { error: "no parent tr" };

    const rowClass = row.className;

    // Sample first 3 tbody rows
    const allRows = document.querySelectorAll("tbody tr");
    const rowSamples = Array.from(allRows)
      .slice(0, 3)
      .map((r) => ({
        className: r.className,
        innerText: r.innerText.substring(0, 120).replace(/\n/g, " | "),
      }));

    // Cells of the row containing roster_class
    const cells = Array.from(row.querySelectorAll("td")).map((td) => ({
      cls: td.className.substring(0, 60),
      lbl: td.dataset.label,
      txt: td.textContent.trim().substring(0, 40),
    }));

    // Count all possible row selectors
    const counts = {
      "tr.sidearm-roster-player": document.querySelectorAll(
        "tr.sidearm-roster-player",
      ).length,
      'tr[class*="roster"]': document.querySelectorAll('tr[class*="roster"]')
        .length,
      "tbody tr": document.querySelectorAll("tbody tr").length,
      "td.roster_class": document.querySelectorAll("td.roster_class").length,
    };

    return {
      rowClass,
      cells,
      rowSamples,
      counts,
      classText: classCell.textContent.trim(),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => console.error(e.message));
