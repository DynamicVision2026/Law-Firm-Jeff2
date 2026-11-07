// Step 2: turn the extracted facts into a small outcomes table the report can show.
//
//   node tools/outcomes/build.mjs --market tw
//
// Reads data/outcomes/<market>-facts.jsonl, writes engine/outcomes/<market>.json (numbers only).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const market = (process.argv.join(" ").match(/--market\s+(\w+)/) || [])[1] || "tw";
const root = join(import.meta.dirname, "..", "..");
const src = join(root, "data", "outcomes", `${market}-facts.jsonl`);
if (!existsSync(src)) { console.error("No facts yet:", src, "— run extract.mjs first."); process.exit(1); }
const rows = readFileSync(src, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => ["full", "partial", "lost"].includes(r.outcome));

const MIN = 20;        // fewer decisions than this: don't show a number
const MIN_SPLIT = 8;   // per side, for "with X / without X" comparisons
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const median = (xs) => { const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const won = (r) => r.outcome === "full" || r.outcome === "partial";

const out = { market, builtAt: new Date().toISOString().slice(0, 10), source: market === "tw" ? "司法院裁判書（公開判決）" : "published judgments", categories: {} };
for (const category of [...new Set(rows.map((r) => r.category))]) {
  const all = rows.filter((r) => r.category === category);
  const contested = all.filter((r) => !r.default_judgment); // cases the other side actually fought
  if (all.length < MIN) { console.log(category, "— only", all.length, "decisions, not shown yet"); continue; }
  const awardedRatio = all.filter((r) => won(r) && r.claimed && r.awarded != null).map((r) => r.awarded / r.claimed);
  const factors = {};
  for (const id of [...new Set(all.flatMap((r) => Object.keys(r.factors || {})))]) {
    const yes = all.filter((r) => r.factors?.[id] === true), no = all.filter((r) => r.factors?.[id] === false);
    if (yes.length >= MIN_SPLIT && no.length >= MIN_SPLIT) {
      factors[id] = { withPct: pct(yes.filter(won).length, yes.length), withN: yes.length, withoutPct: pct(no.filter(won).length, no.length), withoutN: no.length };
    }
  }
  const years = all.map((r) => r.year).filter(Boolean);
  out.categories[category] = {
    n: all.length,
    winPct: pct(all.filter(won).length, all.length),               // got all or part of the claim
    fullPct: pct(all.filter((r) => r.outcome === "full").length, all.length),
    contestedN: contested.length,
    contestedWinPct: contested.length >= MIN_SPLIT ? pct(contested.filter(won).length, contested.length) : null,
    medianAwarded: median(all.filter(won).map((r) => r.awarded)),
    medianAwardedOfClaim: awardedRatio.length >= MIN_SPLIT ? Math.round(median(awardedRatio) * 100) : null,
    years: years.length ? [Math.min(...years), Math.max(...years)] : null,
    factors,
  };
  console.log(category, out.categories[category]);
}
mkdirSync(join(root, "engine", "outcomes"), { recursive: true });
writeFileSync(join(root, "engine", "outcomes", `${market}.json`), JSON.stringify(out, null, 2) + "\n");
console.log("Saved engine/outcomes/" + market + ".json — restart Jeff 2 to show it in reports.");
