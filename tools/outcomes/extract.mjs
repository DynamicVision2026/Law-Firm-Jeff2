// Step 1 of "how similar cases ended": read court judgments and let the AI pull out a few outcome facts.
//
//   node tools/outcomes/extract.mjs --market tw --in <folder of judgments> [--max 300]
//
// <folder> can hold Taiwan Judicial Yuan JSON files (monthly open-data package or files saved by
// fetch-tw.mjs: fields JID, JTITLE, JFULL) or plain .txt files (one judgment each, e.g. Hong Kong).
// Output: data/outcomes/<market>-facts.jsonl — only the extracted facts and the judgment ID,
// never the judgment text or any names. Re-running skips judgments already done.

import { readdirSync, readFileSync, statSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { llmJSON } from "../../server/server.mjs";
import { caseType } from "../../engine/casetypes.js";

const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((s) => s.trim().split(/\s+(.*)/s).slice(0, 2)));
const market = args.market || "tw";
const inDir = args.in;
const max = Number(args.max || 300); // per case type
const dry = "dry" in args; // --dry: only list which judgments would be read, no AI calls
if (!inDir || !existsSync(inDir)) { console.error("Usage: node tools/outcomes/extract.mjs --market tw --in <folder> [--max 300]"); process.exit(1); }
if (!dry && !process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is missing (.env)."); process.exit(1); }

// Which judgments belong to which of our case types, by the case title (案由). Civil cases where the
// person who uses our tool is usually the one suing.
const TITLES = {
  tw: {
    money_owed: /借款|借貸|票款|清償債務|返還借/,
    labor: /資遣費|工資|薪資|加班費|僱傭關係|退休金|職業災害/,
    housing: /押租金|押金/,
    traffic: /交通/,
  },
  hk: {
    money_owed: /loan|debt|money (lent|due|owed)|dishonoured cheque/i,
    labor: /employment|wages|wrongful dismissal|severance|Labour Tribunal/i,
    housing: /deposit|tenancy|landlord/i,
    traffic: /traffic accident|road accident|personal injur/i,
  },
};

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if ([".json", ".txt"].includes(extname(name).toLowerCase())) yield p;
  }
}

function read(path) {
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  if (extname(path).toLowerCase() === ".txt") {
    return { id: basename(path, ".txt"), title: raw.slice(0, 300), text: raw };
  }
  const j = JSON.parse(raw);
  return { id: j.JID, title: j.JTITLE || "", text: j.JFULL || j.JFULLX?.JFULLCONTENT || "" };
}

const civil = (doc) => market !== "tw" || /^[A-Z]{3,4}V,/.test(doc.id); // Taiwan civil courts end in V (e.g. TPDV)
const isJudgment = (doc) => /判決|JUDGMENT|Judgment/.test(doc.text.slice(0, 400));

const outDir = join(import.meta.dirname, "..", "..", "data", "outcomes");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${market}-facts.jsonl`);
const done = new Set(existsSync(outFile) ? readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
const count = {};
for (const l of existsSync(outFile) ? readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean) : []) {
  const c = JSON.parse(l).category; count[c] = (count[c] || 0) + 1;
}

async function extract(category, doc) {
  const ct = caseType(category);
  const factorSpec = ct.factors.map((f) => `"${f.id}": true if "${f.yes}", false if "${f.no}", null if the judgment does not say`).join(",\n   ");
  const text = doc.text.length > 9000 ? doc.text.slice(0, 7000) + "\n…\n" + doc.text.slice(-2000) : doc.text;
  return llmJSON(
    "You read court judgments and extract outcome facts as JSON only. Do not include any names.",
    `Case type we are interested in: ${category}. Read this judgment and return JSON:
{"relevant": true only if this is a decided civil case of this type where an individual is suing (not a procedural ruling),
 "outcome": "full" (plaintiff got all), "partial" (got part), "lost" (claim dismissed), or "other",
 "claimed": amount the plaintiff asked for as a number in local currency, or null,
 "awarded": amount the court ordered as a number, 0 if lost, or null,
 "default_judgment": true if the defendant did not appear or did not contest (e.g. 一造辯論),
 "factors": {${factorSpec}}}
Judgment: """${text}"""`
  );
}

let processed = 0;
for (const path of files(inDir)) {
  let doc;
  try { doc = read(path); } catch { continue; }
  if (!doc.id || done.has(doc.id) || !civil(doc) || !isJudgment(doc)) continue;
  const category = Object.entries(TITLES[market] || TITLES.tw).find(([, re]) => re.test(doc.title))?.[0];
  if (!category || (count[category] || 0) >= max) continue;
  if (dry) { count[category] = (count[category] || 0) + 1; processed++; console.log("  would read", category, doc.id, doc.title); continue; }
  try {
    const f = await extract(category, doc);
    if (!f.relevant) continue;
    const court = market === "tw" ? doc.id.split(",")[0] : null;
    const rec = { id: doc.id, market, category, court, year: Number(doc.id.split(",")[4]?.slice(0, 4)) || null,
      outcome: f.outcome, claimed: Number(f.claimed) || null, awarded: f.awarded == null ? null : Number(f.awarded),
      default_judgment: !!f.default_judgment, factors: f.factors || {} };
    appendFileSync(outFile, JSON.stringify(rec) + "\n");
    done.add(doc.id); count[category] = (count[category] || 0) + 1; processed++;
    if (processed % 20 === 0) console.log(`  ${processed} done`, count);
  } catch (e) { console.error("  skipped", doc.id, String(e.message).slice(0, 80)); }
}
console.log(`Finished: ${processed} new judgments. Totals:`, count, "\nNext: node tools/outcomes/build.mjs --market", market);
