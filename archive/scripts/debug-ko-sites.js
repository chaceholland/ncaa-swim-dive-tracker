const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Intercept ALL responses to find JSON roster data
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
    const jsonResponses = [];

    const handler = async (res) => {
      const ct = res.headers()["content-type"] || "";
      if (!ct.includes("json")) return;
      const url = res.url();
      try {
        const json = await res.json();
        if (json && typeof json === "object") {
          const keys = Object.keys(json).join(",").substring(0, 80);
          const len = JSON.stringify(json).length;
          jsonResponses.push({ url: url.substring(0, 120), keys, len });
          // Look for roster data
          if (len > 1000) {
            const str = JSON.stringify(json);
            if (
              str.includes("class") ||
              str.includes("year") ||
              str.includes("roster") ||
              str.includes("name")
            ) {
              console.log("POTENTIAL ROSTER JSON:", url.substring(0, 120));
              console.log("  Keys:", keys);
              console.log("  Sample:", str.substring(0, 300));
            }
          }
        }
      } catch {
        // ignore
      }
    };

    page.on("response", handler);
    await page.goto(site.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(10000);
    page.off("response", handler);

    console.log("All JSON responses:");
    jsonResponses.forEach((r) =>
      console.log(`  len=${r.len} ${r.url} [${r.keys}]`),
    );

    // Also check: does the page source contain any inline JSON roster data?
    const inlineData = await page.evaluate(() => {
      // Look for script tags with JSON
      const scripts = Array.from(
        document.querySelectorAll("script:not([src])"),
      );
      const rosterScripts = scripts.filter((s) => {
        const t = s.textContent;
        return (
          t &&
          (t.includes('"class"') ||
            t.includes('"year"') ||
            t.includes("roster") ||
            t.includes("players")) &&
          t.length > 200
        );
      });
      return rosterScripts.map((s) => s.textContent.substring(0, 300));
    });
    if (inlineData.length) {
      console.log("Inline script data:");
      inlineData
        .slice(0, 3)
        .forEach((d) => console.log(" ", d.substring(0, 200)));
    } else {
      console.log("No inline roster scripts found");
    }
  }

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
