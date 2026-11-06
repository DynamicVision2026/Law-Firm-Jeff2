// Run: node tests/server.test.mjs   (test mode, no AI key)
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
delete process.env.ANTHROPIC_API_KEY;
process.env.LOG_FILE = join(mkdtempSync(join(tmpdir(), "jeff2-")), "log.jsonl");
const { server, redact } = await import("../server/server.mjs");
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const post = async (p, b) => (await fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();

// privacy
assert.equal(redact("電話 090-1234-5678 mail a@b.jp"), "電話 [number] mail [email]");

// money owed (light report) in all three languages
for (const [market, text] of [["jp", "友人に50万円を貸したが返してくれない"], ["tw", "借給朋友50萬元一直不還"], ["cn", "借给朋友5万元一直不还"]]) {
  const t = await post("/api/triage", { market, text });
  assert.equal(t.category, "money_owed"); assert.equal(t.deep, false); assert.equal(t.followups.length, 4);
  const answers = Object.fromEntries(t.followups.map((q) => [q.id, q.options[1].value]));
  const r = await post("/api/report", { market, text, category: t.category, answers, consent: true });
  assert.ok(r.headline && r.cost && r.nextStep && r.reasons.length === 3);
  console.log(market, "money_owed ok |", r.headline);
}

// traffic (deep pack) in all three languages
for (const [market, text] of [["jp", "追突事故でむちうち"], ["tw", "被追撞車禍"], ["cn", "被追尾交通事故"]]) {
  const t = await post("/api/triage", { market, text });
  assert.equal(t.category, "traffic"); assert.equal(t.deep, true);
  const r = await post("/api/report", { market, text, category: "traffic", consent: true,
    answers: { injured: "yes", injury_type: "fracture", treatment_months: "6", treatment_status: "fixed", fault: "other_100", insurer_offer: "offered", lawyer_rider: "yes", accident_when: t.followups.find((q) => q.id === "accident_when").options[0].value } });
  assert.equal(r.level, "high");
  if (market === "jp") assert.equal(r.range.min, 90); else assert.equal(r.range, null);
  console.log(market, "traffic ok |", r.headline);
}

// log has no free text
const log = readFileSync(process.env.LOG_FILE, "utf8");
assert.ok(!log.includes("友人") && !log.includes("朋友"));
console.log("log entries:", log.trim().split("\n").length, "| no free text stored");
server.close();
