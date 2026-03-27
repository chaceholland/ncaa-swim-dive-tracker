const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  for (const site of [
    {
      name: "Yale",
      url: "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
    },
    {
      name: "UNLV",
      url: "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
    },
  ]) {
    console.log("\n===", site.name, "===");
    await page.goto(site.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(8000);

    const data = await page.evaluate(() => {
      // Parse all inline scripts for JSON
      const scripts = Array.from(
        document.querySelectorAll("script:not([src])"),
      );
      const results = [];

      for (const script of scripts) {
        const text = script.textContent.trim();
        if (!text) continue;

        // Try to parse as JSON
        if (text.startsWith("{") || text.startsWith("[")) {
          try {
            const json = JSON.parse(text);
            const str = JSON.stringify(json);
            if (
              str.includes("class_year") ||
              str.includes("academic_year") ||
              str.includes('"class"') ||
              str.includes("year_in_school") ||
              str.includes("eligibility")
            ) {
              results.push({ type: "json", sample: str.substring(0, 400) });
            }
          } catch {
            /**/
          }
        }

        // Look for SIDEARM window.data or roster data assignments
        if (
          text.includes("window.data") ||
          text.includes("rosterData") ||
          text.includes("class_year") ||
          text.includes("year_in_school")
        ) {
          results.push({ type: "script-var", sample: text.substring(0, 400) });
        }

        // Look for JSON-LD schema with Person type
        if (
          script.type === "application/ld+json" ||
          text.includes('"@type":"Person"') ||
          text.includes('"@type": "Person"')
        ) {
          try {
            const json = JSON.parse(text);
            const str = JSON.stringify(json);
            results.push({
              type: "jsonld",
              keys: Object.keys(json).join(","),
              sample: str.substring(0, 500),
            });
          } catch {
            results.push({
              type: "jsonld-raw",
              sample: text.substring(0, 400),
            });
          }
        }
      }

      // Also try accessing ko viewmodel data directly
      let koData = null;
      try {
        const tb = document.querySelector("tbody");
        if (tb) {
          const koContext = ko ? ko.contextFor(tb) : null;
          if (koContext) {
            koData = JSON.stringify(koContext.$data).substring(0, 400);
          }
        }
      } catch {
        /**/
      }

      return { results, koData };
    });

    console.log("Results:", data.results.length);
    data.results.forEach((r) =>
      console.log("  [", r.type, "]", r.sample?.substring(0, 200)),
    );
    if (data.koData) console.log("KO data:", data.koData.substring(0, 300));

    // Also try fetching the SIDEARM roster service directly
    const rosterServiceUrl =
      site.url.replace("/sports/", "/services/") +
      ".ashx?type=roster&sport_id=";
    console.log("Trying SIDEARM roster service pattern...");

    // Check page source for sport_id
    const sportId = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll("script:not([src])"),
      );
      for (const s of scripts) {
        const m = s.textContent.match(/sport_id["\s:=]+(\d+)/);
        if (m) return m[1];
      }
      // Also check meta tags
      const metas = document.querySelectorAll("meta");
      for (const m of metas) {
        const content = m.getAttribute("content") || "";
        const name = m.getAttribute("name") || "";
        if (name.includes("sport") || content.includes("sport")) {
          return name + "=" + content;
        }
      }
      return null;
    });
    console.log("Sport ID found:", sportId);
  }

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
