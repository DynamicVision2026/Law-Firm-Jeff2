// Run: node tests/engine.test.mjs
import { readFileSync } from "node:fs";
import { runCheck, ruleJudge, logRecord } from "../engine/engine.js";
import assert from "node:assert/strict";

const load = (m) => JSON.parse(readFileSync(new URL(`../case-packs/${m}/traffic.json`, import.meta.url)));

const strong = { injured: "yes", injury_type: "fracture", treatment_months: "6", treatment_status: "fixed",
  fault: "other_100", insurer_offer: "offered", lawyer_rider: "yes", region: "", story: "追突された" };
const weak = { injured: "no", fault: "me_most", insurer_offer: "none", lawyer_rider: "no", region: "" };

for (const m of ["jp", "tw", "cn"]) {
  const pack = load(m);
  const when = pack.questions.find((q) => q.id === "accident_when").options;
  strong.accident_when = when[0].value; weak.accident_when = when[0].value;
  strong.region = weak.region = pack.questions.find((q) => q.id === "region").options[0].value;

  const s = await runCheck(pack, strong);
  const w = await runCheck(pack, weak);
  assert.equal(s.judgment.recommendation, "high");
  assert.equal(w.judgment.recommendation, "low");
  assert.ok(s.reasons.length > 0 && s.reasons.length <= 3);
  assert.ok(s.headline && s.nextStep && s.disclaimer && s.cost);
  if (m === "jp") assert.deepEqual([s.range.min, s.range.max], [90, 116]);
  else assert.equal(s.range, null);
  // signed settlement must be urgent with a high warning
  const signed = await runCheck(pack, { ...weak, insurer_offer: "signed" });
  assert.equal(signed.judgment.urgency, "urgent");
  assert.ok(signed.warnings.some((x) => x.level === "high"));
  // log must not contain free text
  assert.equal(logRecord(pack, strong, s).answers.story, undefined);
  console.log(`${m}: ok  | ${s.headline} | ${s.value.text} | ${s.range ? s.range.min + "-" + s.range.max + s.range.unit : "no table"}`);
}
