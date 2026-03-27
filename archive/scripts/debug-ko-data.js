const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("\n=== Yale Knockout data ===");
  await page.goto(
    "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(8000);

  const yaleData = await page.evaluate(() => {
    // Try accessing the Knockout viewmodel
    try {
      // Method 1: ko.dataFor on the tbody
      const tbody = document.querySelector("tbody");
      if (tbody && typeof ko !== "undefined") {
        const ctx = ko.contextFor(tbody);
        if (ctx)
          return {
            source: "ko-context",
            data: JSON.stringify(ctx.$root || ctx.$data).substring(0, 1000),
          };
      }

      // Method 2: Look for sidearm global variables
      const sidearmVars = [];
      for (const key of Object.keys(window)) {
        if (
          key.includes("roster") ||
          key.includes("player") ||
          key.includes("athlete") ||
          key.includes("data")
        ) {
          const val = window[key];
          if (typeof val === "object" && val !== null) {
            const str = JSON.stringify(val).substring(0, 200);
            if (
              str.includes("class") ||
              str.includes("year") ||
              str.includes("name")
            ) {
              sidearmVars.push({ key, sample: str.substring(0, 200) });
            }
          }
        }
      }

      // Method 3: Look for all script tags with class year data
      const scripts = Array.from(
        document.querySelectorAll("script:not([src])"),
      );
      const classYearScripts = [];
      for (const s of scripts) {
        const text = s.textContent;
        if (
          text &&
          (text.includes('"class_year"') ||
            text.includes('"year_eligibility"') ||
            text.includes('"academic_year"') ||
            text.includes('"year"'))
        ) {
          classYearScripts.push(text.substring(0, 500));
        }
      }

      return { sidearmVars, classYearScripts };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log("Yale KO data:", JSON.stringify(yaleData, null, 2));

  // Try to extract just player names with class years from the page source
  // by looking at the rendered HTML more carefully
  const yalePlayers = await page.evaluate(() => {
    // The HTML might have the data in a hidden JSON blob
    const allText = document.body.innerHTML;
    // Look for a pattern like: "year":"Fr" or "class":"So"
    const matches = [];
    const re =
      /"(?:year|class|year_eligibility|academic_year|class_year)"\s*:\s*"([^"]+)"/gi;
    let m;
    while ((m = re.exec(allText)) !== null) {
      matches.push(m[0].substring(0, 60));
      if (matches.length >= 20) break;
    }
    return matches;
  });
  console.log("Yale year patterns in HTML:", yalePlayers);

  // Check page source for "sidearmv" or roster initialization
  const pageSource = await page.content();
  const koInit = pageSource.match(/ko\.applyBindings\([^)]+\)/g);
  console.log("KO applyBindings calls:", koInit?.slice(0, 5));

  // Find all patterns like: var X = ko.mapping.fromJS(
  const koMappings = pageSource.match(/ko\.mapping\.fromJS\(/g);
  console.log("KO mapping.fromJS calls:", koMappings?.length);

  // Find sidearm_roster or roster_data
  const rosterInit = pageSource.match(
    /(?:roster_data|sidearm_roster|roster_model|view_model)\s*=\s*[^;]+/g,
  );
  console.log("Roster init patterns:", rosterInit?.slice(0, 3));

  // Find inline JSON arrays (large ones > 1000 chars)
  const jsonArrays = pageSource.match(/\[{[^<]{500,}?\}]/g);
  if (jsonArrays) {
    console.log("Large JSON arrays found:", jsonArrays.length);
    jsonArrays.slice(0, 2).forEach((j) => {
      try {
        const parsed = JSON.parse(j);
        console.log("  Array[0] keys:", Object.keys(parsed[0]).join(","));
        if (parsed[0].class_year || parsed[0].year || parsed[0].academic_year) {
          console.log(
            "  HAS CLASS YEAR:",
            JSON.stringify(parsed[0]).substring(0, 200),
          );
        }
      } catch {
        /**/
      }
    });
  }

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
