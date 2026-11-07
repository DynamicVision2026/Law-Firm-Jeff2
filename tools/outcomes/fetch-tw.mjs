// Collect recent Taiwan civil judgments through the Judicial Yuan's official judgment API.
//
//   node tools/outcomes/fetch-tw.mjs [--limit 3000]
//
// Needs a free account from the 司法院資料開放平臺 in .env:  TW_JUDICIAL_USER=...  TW_JUDICIAL_PASSWORD=...
// The API only works 00:00–06:00 Taiwan time, and each run returns the judgments published 7 days earlier,
// so run it once a night for a few nights (or use a monthly open-data package instead — see docs/similar-cases.md).
// Saves civil judgments of our case types to data/tw-judgments/<id>.json (JID, JTITLE, JFULL).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "../../server/server.mjs"; // loads .env

const API = "https://data.judicial.gov.tw/jdg/api";
const limit = Number((process.argv.join(" ").match(/--limit\s+(\d+)/) || [])[1] || 3000);
const user = process.env.TW_JUDICIAL_USER, password = process.env.TW_JUDICIAL_PASSWORD;
if (!user || !password) { console.error("Add TW_JUDICIAL_USER and TW_JUDICIAL_PASSWORD to .env (free account at the 司法院資料開放平臺)."); process.exit(1); }

const twHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", hour: "numeric", hourCycle: "h23" }).format(new Date()));
if (twHour >= 6) { console.error(`The Taiwan judgment API only works 00:00–06:00 Taiwan time (now ${twHour}:00 there). Try again then.`); process.exit(1); }

const post = async (path, body) => {
  const res = await fetch(`${API}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WANTED = /借款|借貸|票款|清償債務|返還借|資遣費|工資|薪資|加班費|僱傭關係|退休金|職業災害|押租金|押金|交通/;

const auth = await post("Auth", { user, password });
if (!auth.Token) { console.error("Login failed — check the account in .env."); process.exit(1); }
const token = auth.Token;
const lists = await post("JList", { token });
const ids = lists.flatMap((d) => d.list || []).filter((id) => /^[A-Z]{3,4}V,/.test(id)); // civil courts only
console.log(`${ids.length} civil judgments in today's list`);

const dir = join(import.meta.dirname, "..", "..", "data", "tw-judgments");
mkdirSync(dir, { recursive: true });
let saved = 0, checked = 0;
for (const id of ids) {
  if (checked >= limit) break;
  const file = join(dir, id.replace(/[^\w,.-]/g, "_") + ".json");
  if (existsSync(file)) continue;
  checked++;
  try {
    const d = await post("JDoc", { token, j: id });
    if (!d.JTITLE || !WANTED.test(d.JTITLE)) continue;
    const text = d.JFULLX?.JFULLCONTENT || "";
    if (!text) continue;
    writeFileSync(file, JSON.stringify({ JID: d.JID || id, JTITLE: d.JTITLE, JDATE: d.JDATE, JFULL: text }));
    saved++;
  } catch (e) { console.error("  skipped", id, e.message); }
  await sleep(300); // be gentle with the court's server
  if (checked % 200 === 0) console.log(`  checked ${checked}, saved ${saved}`);
}
console.log(`Saved ${saved} judgments of our case types. Next: node tools/outcomes/extract.mjs --market tw --in data/tw-judgments`);
