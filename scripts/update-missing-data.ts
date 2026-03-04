import { createClient } from "@supabase/supabase-js";
import { chromium, Page } from "playwright";

const supabaseUrl = "https://dtnozcqkuzhjmjvsfjqk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA";

const supabase = createClient(supabaseUrl, supabaseKey);

interface TeamInfo {
  name: string;
  url: string;
}

interface AthleteData {
  name: string;
  photo_url: string | null;
  position?: string;
  class_year?: string;
  profile_url?: string;
}

interface ScrapingResult {
  team: string;
  processed: number;
  added: number;
  updated: number;
  skipped: number;
  error?: string;
}

// Teams that need work
const teamsToScrape: TeamInfo[] = [
  {
    name: "Georgia Tech",
    url: "https://ramblinwreck.com/sports/mens-swimming-diving/roster/",
  },
  {
    name: "Alabama",
    url: "https://rolltide.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Duke",
    url: "https://goduke.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "TCU",
    url: "https://gofrogs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Louisville",
    url: "https://gocards.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "South Carolina",
    url: "https://gamecocksonline.com/sports/mens-swimming-and-diving/roster/",
  },
  {
    name: "Arizona State",
    url: "https://thesundevils.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Penn State",
    url: "https://gopsusports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Indiana",
    url: "https://iuhoosiers.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Purdue",
    url: "https://purduesports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Dartmouth",
    url: "https://dartmouthsports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Ohio State",
    url: "https://ohiostatebuckeyes.com/sports/m-swim/roster/",
  },
  {
    name: "Florida State",
    url: "https://seminoles.com/sports/swimming-diving/roster/",
  },
  {
    name: "NC State",
    url: "https://gopack.com/sports/mens-swimming-and-diving/roster",
  },
];

function normalizeClassYear(year?: string): string | null {
  if (!year) return null;
  const normalized = year.trim().toUpperCase();
  if (
    normalized.startsWith("FR") ||
    normalized === "FRESHMAN" ||
    normalized === "1" ||
    normalized === "1ST"
  )
    return "freshman";
  if (
    normalized.startsWith("SO") ||
    normalized === "SOPHOMORE" ||
    normalized === "2" ||
    normalized === "2ND"
  )
    return "sophomore";
  if (
    normalized.startsWith("JR") ||
    normalized === "JUNIOR" ||
    normalized === "3" ||
    normalized === "3RD"
  )
    return "junior";
  if (
    normalized.startsWith("SR") ||
    normalized === "SENIOR" ||
    normalized === "4" ||
    normalized === "4TH"
  )
    return "senior";
  if (normalized.startsWith("GR") || normalized.includes("GRADUATE"))
    return "senior";
  return null;
}

function classifyAthleteType(position?: string): string {
  if (!position) return "swimmer";
  const posLower = position.toLowerCase();
  if (posLower.includes("dive")) return "diver";
  return "swimmer";
}

function normalizePhotoUrl(url?: string, baseUrl?: string): string | null {
  if (!url) return null;

  url = url.trim();
  if (!url) return null;

  // Skip placeholder/empty images
  if (
    url.includes("placeholder") ||
    url.includes("default") ||
    url.includes("no-image") ||
    url.includes("blank")
  ) {
    return null;
  }

  // Convert relative URLs to absolute
  if (url.startsWith("/")) {
    const domain = new URL(baseUrl || "https://example.com").hostname;
    url = `https://${domain}${url}`;
  } else if (url.startsWith("../")) {
    const domain = new URL(baseUrl || "https://example.com").hostname;
    url = `https://${domain}/${url.replace(/^\.\.\//, "")}`;
  }

  // Try to get high-quality versions
  if (url.includes("?")) {
    url = url.split("?")[0]; // Remove query params that might be for sizing
  }

  return url;
}

async function scrapeTeamRoster(
  page: Page,
  teamName: string,
  url: string,
): Promise<AthleteData[]> {
  console.log(`\n🏊 Scraping ${teamName} from ${url}`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(6000); // Wait for JS rendering

    const athletes = await page.evaluate(() => {
      const results: AthleteData[] = [];

      // Pattern 1: Sidearm Sports (most common)
      const sidearmPlayers = document.querySelectorAll(
        ".sidearm-roster-players .sidearm-roster-player",
      );
      if (sidearmPlayers.length > 0) {
        sidearmPlayers.forEach((player) => {
          const nameEl = player.querySelector(".sidearm-roster-player-name");
          const photoEl = player.querySelector(
            "img.sidearm-roster-player-image",
          );
          const posEl = player.querySelector(".sidearm-roster-player-position");
          const classEl = player.querySelector(
            ".sidearm-roster-player-class_year",
          );
          const profileLink = player.querySelector("a");

          if (nameEl) {
            results.push({
              name: nameEl.textContent?.trim() || "",
              photo_url: photoEl
                ? photoEl.getAttribute("src") ||
                  photoEl.getAttribute("data-src")
                : null,
              position: posEl ? posEl.textContent?.trim() : undefined,
              class_year: classEl ? classEl.textContent?.trim() : undefined,
              profile_url: profileLink
                ? profileLink.getAttribute("href") || undefined
                : undefined,
            });
          }
        });
      }

      // Pattern 2: New Sidearm cards
      if (results.length === 0) {
        const cards = document.querySelectorAll(".s-person-card");
        if (cards.length > 0) {
          cards.forEach((card) => {
            const nameEl = card.querySelector("h3");
            const photoEl = card.querySelector("img");
            const posEl = card.querySelector('.position, [class*="position"]');
            const classEl = card.querySelector('.class-year, [class*="class"]');
            const profileLink = card.querySelector("a");

            if (nameEl) {
              results.push({
                name: nameEl.textContent?.trim() || "",
                photo_url: photoEl
                  ? photoEl.getAttribute("src") ||
                    photoEl.getAttribute("data-src")
                  : null,
                position: posEl ? posEl.textContent?.trim() : undefined,
                class_year: classEl ? classEl.textContent?.trim() : undefined,
                profile_url: profileLink
                  ? profileLink.getAttribute("href") || undefined
                  : undefined,
              });
            }
          });
        }
      }

      // Pattern 3: Table format
      if (results.length === 0) {
        const rows = document.querySelectorAll("table tbody tr");
        if (rows.length > 0) {
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 2) {
              const nameEl = cells[0];
              const posEl = cells[1];
              const photoEl = row.querySelector("img");
              const profileLink = row.querySelector("a");

              if (nameEl.textContent?.trim()) {
                results.push({
                  name: nameEl.textContent?.trim() || "",
                  photo_url: photoEl
                    ? photoEl.getAttribute("src") ||
                      photoEl.getAttribute("data-src")
                    : null,
                  position: posEl ? posEl.textContent?.trim() : undefined,
                  class_year: undefined,
                  profile_url: profileLink
                    ? profileLink.getAttribute("href") || undefined
                    : undefined,
                });
              }
            }
          });
        }
      }

      // Pattern 4: Card/Grid format
      if (results.length === 0) {
        const cards = document.querySelectorAll(
          '[class*="roster-card"], [class*="athlete-card"], [class*="player-card"]',
        );
        if (cards.length > 0) {
          cards.forEach((card) => {
            const nameEl = card.querySelector('[class*="name"], h3, h4');
            const photoEl = card.querySelector("img");
            const posEl = card.querySelector('[class*="position"]');
            const classEl = card.querySelector('[class*="class"]');
            const profileLink = card.querySelector("a");

            if (nameEl) {
              results.push({
                name: nameEl.textContent?.trim() || "",
                photo_url: photoEl
                  ? photoEl.getAttribute("src") ||
                    photoEl.getAttribute("data-src")
                  : null,
                position: posEl ? posEl.textContent?.trim() : undefined,
                class_year: classEl ? classEl.textContent?.trim() : undefined,
                profile_url: profileLink
                  ? profileLink.getAttribute("href") || undefined
                  : undefined,
              });
            }
          });
        }
      }

      return results;
    });

    console.log(`✓ Found ${athletes.length} athletes on page`);

    // Filter to only men's athletes
    const menAthletes = athletes.filter((a) => {
      const text = (a.name + " " + (a.position || "")).toLowerCase();
      return !text.includes("women") && !text.includes("w-");
    });

    console.log(`✓ Filtered to ${menAthletes.length} men's athletes`);

    return menAthletes;
  } catch (error) {
    console.error(
      `✗ Error scraping ${teamName}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getTeamId(teamName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("teams")
      .select("id")
      .eq("name", teamName)
      .single();

    if (error) {
      console.error(`  ✗ Team not found: ${teamName}`);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error(
      `  ✗ Error fetching team ID for ${teamName}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function getExistingAthlete(
  name: string,
  teamId: string,
): Promise<{ id: string; photo_url: string | null } | null> {
  try {
    const { data, error } = await supabase
      .from("athletes")
      .select("id, photo_url")
      .eq("name", name)
      .eq("team_id", teamId)
      .single();

    if (error && (error as any).code !== "PGRST116") {
      console.error(`  ✗ Error checking athlete:`, error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error(
      `  ✗ Error checking athlete:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function insertAthlete(
  athlete: AthleteData & {
    class_year: string | null;
    athlete_type: string;
    profile_url: string | null;
  },
  teamId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("athletes")
      .insert([
        {
          team_id: teamId,
          name: athlete.name,
          photo_url: athlete.photo_url,
          class_year: athlete.class_year,
          athlete_type: athlete.athlete_type,
          hometown: null,
          profile_url: athlete.profile_url,
        },
      ])
      .select();

    if (error) {
      console.error(`    ✗ Insert failed for ${athlete.name}:`, error.message);
      return false;
    }

    console.log(`    ✓ Added ${athlete.name} (new)`);
    return true;
  } catch (error) {
    console.error(
      `    ✗ Error inserting athlete:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

async function updateAthletePhoto(
  athleteId: string,
  photoUrl: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("athletes")
      .update({ photo_url: photoUrl })
      .eq("id", athleteId);

    if (error) {
      console.error(`    ✗ Update failed:`, error.message);
      return false;
    }

    console.log(`    ✓ Updated photo for existing athlete`);
    return true;
  } catch (error) {
    console.error(
      `    ✗ Error updating athlete:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

async function updateTeamAthleteCount(teamId: string): Promise<void> {
  try {
    const { count, error: countError } = await supabase
      .from("athletes")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);

    if (countError) {
      console.error(`  ✗ Error counting athletes:`, countError.message);
      return;
    }

    const { error } = await supabase
      .from("teams")
      .update({ athlete_count: count })
      .eq("id", teamId);

    if (error) {
      console.error(`  ✗ Error updating athlete count:`, error.message);
      return;
    }

    console.log(`  ✓ Updated team athlete count: ${count}`);
  } catch (error) {
    console.error(
      `  ✗ Error updating team count:`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function processTeam(
  browser: any,
  teamName: string,
  url: string,
): Promise<ScrapingResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${teamName}`);
  console.log(`${"=".repeat(60)}`);

  const teamId = await getTeamId(teamName);
  if (!teamId) {
    console.log(`⚠ Skipping ${teamName} - not found in database`);
    return { team: teamName, processed: 0, updated: 0, added: 0, skipped: 0 };
  }

  const page = await browser.newPage();

  try {
    const athletes = await scrapeTeamRoster(page, teamName, url);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const athlete of athletes) {
      const normalizedPhoto = normalizePhotoUrl(
        athlete.photo_url ?? undefined,
        url,
      );
      const existingAthlete = await getExistingAthlete(athlete.name, teamId);

      if (!existingAthlete) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insertData: any = {
          name: athlete.name,
          photo_url: normalizedPhoto,
          position: athlete.position,
          class_year: normalizeClassYear(athlete.class_year),
          athlete_type: classifyAthleteType(athlete.position),
          profile_url: athlete.profile_url
            ? new URL(athlete.profile_url, url).href
            : null,
        };
        const success = await insertAthlete(insertData, teamId);

        if (success) added++;
      } else if (!existingAthlete.photo_url && normalizedPhoto) {
        const success = await updateAthletePhoto(
          existingAthlete.id,
          normalizedPhoto,
        );
        if (success) updated++;
      } else {
        skipped++;
      }
    }

    await updateTeamAthleteCount(teamId);

    const summary: ScrapingResult = {
      team: teamName,
      processed: athletes.length,
      added,
      updated,
      skipped,
    };

    console.log(`\n✓ ${teamName} Summary:`);
    console.log(`  - Processed: ${summary.processed} athletes`);
    console.log(`  - Added: ${summary.added}`);
    console.log(`  - Updated photos: ${summary.updated}`);
    console.log(`  - Skipped: ${summary.skipped}`);

    return summary;
  } catch (error) {
    console.error(
      `✗ Error processing ${teamName}:`,
      error instanceof Error ? error.message : error,
    );
    return {
      team: teamName,
      processed: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  console.log("\n🏊 NCAA Swim & Dive Tracker - Data Update Script");
  console.log("=".repeat(60));
  console.log(`Starting at ${new Date().toISOString()}`);

  let browser: any;
  const results: ScrapingResult[] = [];

  try {
    console.log("\n📱 Launching Playwright browser...");
    browser = await chromium.launch({ headless: true });

    for (const team of teamsToScrape) {
      try {
        const result = await processTeam(browser, team.name, team.url);
        results.push(result);
      } catch (error) {
        console.error(
          `✗ Failed to process ${team.name}:`,
          error instanceof Error ? error.message : error,
        );
        results.push({
          team: team.name,
          processed: 0,
          added: 0,
          updated: 0,
          skipped: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("\n\n" + "=".repeat(60));
    console.log("FINAL SUMMARY");
    console.log("=".repeat(60));

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    results.forEach((r) => {
      totalProcessed += r.processed || 0;
      totalAdded += r.added || 0;
      totalUpdated += r.updated || 0;
      totalSkipped += r.skipped || 0;

      const status = r.error ? "✗" : "✓";
      console.log(
        `${status} ${r.team.padEnd(20)} | Added: ${String(r.added).padStart(2)} | Updated: ${String(r.updated).padStart(2)} | Processed: ${String(r.processed).padStart(2)}`,
      );
    });

    console.log("\n" + "-".repeat(60));
    console.log(`Total Athletes Processed: ${totalProcessed}`);
    console.log(`Total Added: ${totalAdded}`);
    console.log(`Total Updated: ${totalUpdated}`);
    console.log(`Total Skipped: ${totalSkipped}`);
    console.log("-".repeat(60));
    console.log(`Completed at ${new Date().toISOString()}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
