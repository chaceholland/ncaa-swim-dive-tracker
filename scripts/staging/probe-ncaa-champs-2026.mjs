// Lightweight pure-JS dry-run probe. No TypeScript, no esbuild — works in any Node env.
// Mirrors the source discovery the TypeScript importer uses. Read-only HTTP. No DB writes.
//
// Usage: node scripts/staging/probe-ncaa-champs-2026.mjs

const SWIM_EVENTS = [
  "50-free", "100-free", "200-free", "500-free", "1650-free",
  "100-back", "200-back",
  "100-breast", "200-breast",
  "100-fly", "200-fly",
  "200-im", "400-im",
  "200-free-relay", "400-free-relay", "800-free-relay",
  "200-medley-relay", "400-medley-relay",
];
const DIVE_EVENTS = ["1m-diving", "3m-diving", "platform-diving"];

const UA = "ncaa-swim-dive-tracker/staging-probe";

async function tryFetch(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    return { ok: r.ok, status: r.status, json: r.ok ? await r.json().catch(() => null) : null, text: r.ok ? null : await r.text().catch(() => "") };
  } catch (e) {
    return { ok: false, status: 0, err: String(e) };
  }
}

async function findMeet() {
  const candidates = [
    "https://www.swimcloud.com/api/v1/meets/?gender=1&division=1&year=2026",
    "https://www.swimcloud.com/api/v1/meets/?gender=1&division=1&season=2025-26",
    "https://www.swimcloud.com/results/?division=1&gender=M&year=2026",
  ];
  for (const url of candidates) {
    const r = await tryFetch(url);
    console.log(`probe ${url} → ${r.status}${r.err ? " ERR=" + r.err : ""}`);
    if (r.ok && r.json && (r.json.meets || r.json.results)) {
      const meets = r.json.meets ?? r.json.results ?? [];
      const match = meets.find((m) =>
        /NCAA/i.test(m.meet_name ?? m.name ?? "") &&
        /Division\s*I\b/i.test(m.meet_name ?? m.name ?? "") &&
        /Championship/i.test(m.meet_name ?? m.name ?? ""),
      );
      console.log(`  → ${meets.length} meets; match=${match ? (match.meet_id ?? match.id) + " " + (match.meet_name ?? match.name) : "none"}`);
      if (match) return { id: match.meet_id ?? match.id, name: match.meet_name ?? match.name, source: url };
    }
  }
  return null;
}

async function probeEvent(meetId, eventId) {
  const r = await tryFetch(`https://www.swimcloud.com/api/v1/meets/${meetId}/events/${eventId}/results?round=final`);
  return { eventId, status: r.status, count: r.json?.results?.length ?? 0 };
}

(async () => {
  const meet = await findMeet();
  if (!meet) {
    console.log("\nNo meet found via Swimcloud public API. Source needs manual ID or fallback.");
    process.exit(0);
  }
  console.log(`\nMEET ${meet.id} ${meet.name} (via ${meet.source})\n`);
  let swimRows = 0, diveRows = 0;
  for (const ev of [...SWIM_EVENTS, ...DIVE_EVENTS]) {
    const p = await probeEvent(meet.id, ev);
    const isDive = DIVE_EVENTS.includes(ev);
    if (isDive) diveRows += p.count; else swimRows += p.count;
    console.log(`  ${ev.padEnd(20)} ${p.status} → ${p.count} rows`);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`\nTOTAL probed: swim=${swimRows}  dive=${diveRows}\n`);
})();
