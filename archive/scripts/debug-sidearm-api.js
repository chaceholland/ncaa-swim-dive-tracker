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
      sportId: 14,
    },
    {
      name: "UNLV",
      url: "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
      sportId: 9,
    },
  ]) {
    console.log("\n===", site.name, "===");
    await page.goto(site.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(6000);

    // Parse the first JSON-LD ListItem script
    const jsonldData = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      );
      for (const s of scripts) {
        const text = s.textContent.trim();
        if (text.includes("@type") && text.includes("Person")) {
          try {
            return JSON.parse(text);
          } catch {
            /**/
          }
        }
      }
      // Also try non-typed inline scripts
      const allScripts = Array.from(
        document.querySelectorAll("script:not([src])"),
      );
      for (const s of allScripts) {
        const text = s.textContent.trim();
        if (
          (text.startsWith("{") || text.startsWith("[")) &&
          text.includes("Person")
        ) {
          try {
            const json = JSON.parse(text);
            if (JSON.stringify(json).includes("Person")) return json;
          } catch {
            /**/
          }
        }
      }
      return null;
    });

    if (jsonldData) {
      console.log("JSON-LD keys:", Object.keys(jsonldData));
      console.log(
        "JSON-LD item sample:",
        JSON.stringify(jsonldData.item).substring(0, 400),
      );
    } else {
      console.log("No JSON-LD found");
    }

    // Try the SIDEARM services endpoint
    const serviceUrls = [
      `https://${site.name === "Yale" ? "yalebulldogs.com" : "unlvrebels.com"}/services/roster.ashx?type=100&sport_id=${site.sportId}&format=json`,
      `https://${site.name === "Yale" ? "yalebulldogs.com" : "unlvrebels.com"}/services/roster.ashx?format=json&sport_id=${site.sportId}`,
      `https://${site.name === "Yale" ? "yalebulldogs.com" : "unlvrebels.com"}/services/roster.ashx?type=roster&sport_id=${site.sportId}&format=json`,
    ];

    for (const apiUrl of serviceUrls) {
      try {
        const resp = await page.evaluate(async (url) => {
          const r = await fetch(url);
          const text = await r.text();
          return {
            status: r.status,
            text: text.substring(0, 500),
            ct: r.headers.get("content-type"),
          };
        }, apiUrl);
        console.log(
          `API ${apiUrl.split("?")[1]}: status=${resp.status} ct=${resp.ct}`,
        );
        if (resp.text.includes("class") || resp.text.includes("year")) {
          console.log("  ROSTER DATA FOUND:", resp.text.substring(0, 300));
        }
      } catch (e) {
        console.log(`API error: ${e.message}`);
      }
    }
  }

  // Also check what the JSON-LD full content looks like for the roster:
  // It's "ListItem" with position/item -- does it contain class year?
  console.log("\n=== Yale JSON-LD full data ===");
  await page.goto(
    "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(6000);
  const yaleLD = await page.evaluate(() => {
    const allScripts = Array.from(
      document.querySelectorAll("script:not([src])"),
    );
    for (const s of allScripts) {
      const text = s.textContent.trim();
      if (text.includes('"@type":"ListItem"') && text.includes("Person")) {
        return text.substring(0, 2000);
      }
    }
    return null;
  });
  console.log("Yale JSON-LD raw:", yaleLD?.substring(0, 1500));

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
