require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const FAILED_TEAMS = {
  arizona: "120",
  utah: "330",
  penn: "416",
  "george-washington": "251",
  "southern-illinois": "453",
  towson: "320",
  unlv: "440",
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function normalizeName(n) {
  return n
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function lastName(n) {
  const p = normalizeName(n).split(" ");
  return p[p.length - 1];
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  let totalUpdated = 0;

  for (const [slug, teamId] of Object.entries(FAILED_TEAMS)) {
    const { data: unmatched } = await sb
      .from("swim_athletes")
      .select("id,name,team_id")
      .eq("team_id", slug)
      .is("swimcloud_id", null);

    if (!unmatched || unmatched.length === 0) {
      console.log(`[${slug}] none unmatched`);
      continue;
    }

    console.log(`[${slug}] ${unmatched.length} unmatched, fetching roster...`);
    await sleep(2500);

    const res = await fetch(
      `https://www.swimcloud.com/team/${teamId}/roster/`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    const html = await res.text();
    const regex = /href="\/swimmer\/(\d+)\/?">[\s]*([^<\n]{2,50})[\s]*<\/a>/g;

    const roster = [];
    const seen = new Set();
    let m;
    while ((m = regex.exec(html)) !== null) {
      const id = m[1];
      const name = m[2].trim();
      if (!seen.has(id) && name.length > 2) {
        roster.push({ id, name });
        seen.add(id);
      }
    }
    console.log(`  Found ${roster.length} on roster`);

    const { data: existing } = await sb
      .from("swim_athletes")
      .select("swimcloud_id")
      .eq("team_id", slug)
      .not("swimcloud_id", "is", null);
    const existingIds = new Set((existing || []).map((a) => a.swimcloud_id));

    const remaining = [...unmatched];
    for (const ra of roster) {
      if (existingIds.has(ra.id)) continue;
      const rNorm = normalizeName(ra.name);
      const rLast = lastName(ra.name);
      const rFirst = rNorm.split(" ")[0];

      let match = null;

      // Exact
      for (const a of remaining) {
        if (normalizeName(a.name) === rNorm) {
          match = { a, conf: "exact" };
          break;
        }
      }
      // Last+initial
      if (!match) {
        for (const a of remaining) {
          const aN = normalizeName(a.name).split(" ");
          const aL = aN[aN.length - 1];
          if (aL === rLast && aN[0][0] === rFirst[0]) {
            match = { a, conf: "last+init" };
            break;
          }
        }
      }
      // Last only (unique)
      if (!match) {
        const lm = remaining.filter((a) => lastName(a.name) === rLast);
        if (lm.length === 1) match = { a: lm[0], conf: "last-only" };
      }

      if (!match) continue;
      console.log(
        `  ${match.conf}: "${ra.name}" (${ra.id}) -> "${match.a.name}"`,
      );
      const { error } = await sb
        .from("swim_athletes")
        .update({ swimcloud_id: ra.id })
        .eq("id", match.a.id);
      if (!error) {
        totalUpdated++;
        existingIds.add(ra.id);
        remaining.splice(remaining.indexOf(match.a), 1);
      }
    }
    console.log(`  still unmatched: ${remaining.length}`);
  }

  console.log("\nTotal updated:", totalUpdated);
}

main().catch(console.error);
