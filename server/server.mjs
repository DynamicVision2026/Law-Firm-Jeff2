// Jeff 2 server — serves the web page and the API calls.
// Flow: /api/triage (problem type + questions) → /api/judge (Jeff decides, ~seconds) → /api/explain (AI explains Jeff's result).
// Run:  node server/server.mjs           (test mode, no AI key needed)
//       ANTHROPIC_API_KEY=... node server/server.mjs   (real AI)
// Optional env: PORT (8000), LLM_MODEL (claude-haiku-5-5), JEFF_URL (Jeff service), LOG_FILE
// Node 18+, no dependencies.

import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "../engine/engine.js";
import { CATEGORIES, CATEGORY_IDS, categoryById, MARKETS } from "../engine/categories.js";
import { COPY, FOLLOWUPS } from "../engine/copy.js";
import { caseType, estimateFee } from "../engine/casetypes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Private settings file (.env in the project folder, never uploaded). Real env vars win.
const ENV_FILE = join(ROOT, ".env");
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const PORT = Number(process.env.PORT || 8000);
const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "claude-haiku-5-5";
const JEFF_URL = process.env.JEFF_URL || "";
const WEB_SEARCH = (process.env.WEB_SEARCH || "on") !== "off"; // rough "similar cases" estimate from public web info
const LOG_FILE = process.env.LOG_FILE || join(ROOT, "data", "log.jsonl");
const MOCK = !KEY;
const SITE_PASSWORD = process.env.SITE_PASSWORD || ""; // when set, every page and API call needs it

// Team password (HTTP Basic auth; any user name, this password).
import { timingSafeEqual } from "node:crypto";
function authorized(req) {
  if (!SITE_PASSWORD) return true;
  const [scheme, value] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Basic" || !value) return false;
  const pass = Buffer.from(value, "base64").toString().split(":").slice(1).join(":");
  const a = Buffer.from(pass), b = Buffer.from(SITE_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- privacy ----------

// Remove contact details people type by accident. The free text itself is never stored.
export function redact(text) {
  return String(text || "")
    .slice(0, 2500)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]")
    .replace(/〒?\d{3}-\d{4}/g, "[postal]");
}

// ---------- AI calls ----------

async function llmJSONOnce(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    const kinds = (data.content || []).map((b) => b.type).join(",") || "none";
    throw new Error(`AI reply had no JSON (stop: ${data.stop_reason}, blocks: ${kinds}): ${text.slice(0, 150)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

// One automatic retry: an occasional empty or cut-off reply should not reach the person.
export async function llmJSON(system, user) {
  try { return await llmJSONOnce(system, user); }
  catch (e) {
    if (/LLM 4(00|01|03)/.test(e.message)) throw e; // bad key or request: retrying won't help
    return await llmJSONOnce(system, user);
  }
}

const GUARDRAILS = `You are the triage step of a free legal pre-check run under lawyer supervision.
Rules: give general information only, never legal advice; never predict a win or give a probability;
never repeat personal names, addresses or contact details; be calm, plain and kind; reply with JSON only.`;

// Last AI problem, shown on /api/status (never includes the key or the person's text).
const STATUS = { lastAiError: null, lastAiErrorAt: null, aiOk: 0, aiFailed: 0 };
function aiFailed(where, e) {
  STATUS.aiFailed++;
  const cause = e.cause ? ` (cause: ${e.cause.code || ""} ${e.cause.message || e.cause})` : "";
  STATUS.lastAiError = `${where}: ${String(e.message || e).slice(0, 300)}${cause}`.slice(0, 500);
  STATUS.lastAiErrorAt = new Date().toISOString();
  console.error("[AI error]", STATUS.lastAiError);
}

async function classify(text, lang) {
  if (MOCK) return mockClassify(text);
  try { const r = await classifyLLM(text, lang); STATUS.aiOk++; return r; }
  catch (e) { aiFailed("classify", e); return { ...mockClassify(text), source: "fallback" }; }
}

async function classifyLLM(text, lang) {
  const out = await llmJSON(
    GUARDRAILS,
    `Classify this person's problem.
Categories: ${CATEGORY_IDS.join(", ")}
Notes: anything that started with a traffic accident is "traffic", even if the dispute is now with an insurer; "insurance" is only for non-accident claims. Renting and deposits are "housing", not "consumer".
Return JSON: {"category": one id, "urgency": "urgent" if a deadline, court papers, a signature request, dismissal, arrest or danger is mentioned else "normal", "summary": one neutral sentence in ${lang} restating the problem without names}
Problem: """${text}"""`
  );
  if (!CATEGORY_IDS.includes(out.category)) out.category = "other";
  if (!["urgent", "normal"].includes(out.urgency)) out.urgency = "normal";
  return { ...out, source: "llm" };
}

// English descriptions Jeff chooses between (it reads Japanese and Chinese input).
const JEFF_LABELS = {
  money_owed: "Someone owes the person money and will not pay it back (loans to friends or family, unpaid invoices)",
  own_debt: "The person's own debts they cannot repay (loans, credit cards, debt collection against them)",
  labor: "Work problems: unpaid wages or overtime, dismissal, forced resignation, workplace harassment",
  traffic: "Traffic accidents and their compensation or insurance settlement",
  insurance: "An insurance company refusing or reducing a claim (not a traffic accident)",
  divorce: "Divorce or separation, division of property, compensation between spouses",
  inheritance: "Inheritance, wills and estates",
  child: "Child custody, visitation or child support",
  housing: "Renting a home or room: landlord keeps the security deposit, move-out cleaning or repair charges, rent, eviction, problems with the landlord or property manager",
  consumer: "Buying goods or services from a shop or company: refunds, cancelling contracts, subscriptions, scams and fraud (not renting a home)",
  medical: "Medical accidents or malpractice",
  neighbor: "Disputes with neighbours (noise, boundaries, trouble nearby)",
  defamation: "Defamation, online abuse, harmful posts on the internet",
  criminal: "Criminal matters, as a victim or as the accused, police involvement",
  visa: "Visa, residence status and immigration procedures",
};

async function jeffClassify(text) {
  if (!JEFF_URL) return null;
  try {
    const res = await fetch(JEFF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, labels: JEFF_LABELS }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const out = await res.json();
    const category = CATEGORY_IDS.includes(out.category) ? out.category : "other";
    return { category, confidence: out.confidence ?? null, urgency: out.urgency ?? null };
  } catch { return null; }
}

// ---------- test-mode fallbacks (no AI key) ----------

const KEYWORDS = [
  ["traffic", ["事故", "追突", "車禍", "追撞", "追尾", "交通"]],
  ["labor", ["残業", "給料", "給与", "解雇", "退職", "加班", "工资", "薪資", "薪资", "解僱", "辞退", "裁员", "勞資"]],
  ["divorce", ["離婚", "离婚", "別居", "分居"]],
  ["inheritance", ["相続", "遺言", "繼承", "继承", "遺囑", "遗嘱", "遺產", "遗产"]],
  ["child", ["親権", "養育費", "監護", "扶養費", "抚养"]],
  ["housing", ["敷金", "退去", "家賃", "大家", "押金", "房東", "房东", "租"]],
  ["own_debt", ["借金", "返済できない", "欠債", "欠债", "還不起", "还不起", "信用卡債", "网贷"]],
  ["money_owed", ["貸し", "貸した", "返して", "返さ", "借用書", "未払い", "借给", "借給", "不還", "不还", "欠款", "欠錢", "欠钱"]],
  ["insurance", ["保険", "保險", "保险"]],
  ["consumer", ["詐欺", "詐騙", "诈骗", "返金", "退款", "解約"]],
  ["medical", ["医療", "醫療", "医疗", "手術", "手术"]],
  ["defamation", ["誹謗", "中傷", "誹謗", "诽谤", "ネット", "網路", "网络"]],
  ["neighbor", ["近所", "騒音", "鄰居", "邻居", "噪音"]],
  ["criminal", ["逮捕", "警察", "被害届", "報警", "报警", "刑事"]],
  ["visa", ["ビザ", "在留", "簽證", "签证", "居留"]],
];
function mockClassify(text) {
  const hit = KEYWORDS.find(([, words]) => words.some((w) => text.includes(w)));
  const urgent = /裁判所|法院|サイン|签字|簽名|解雇|期限|時効|时效|時效|逮捕/.test(text);
  return { category: hit ? hit[0] : "other", urgency: urgent ? "urgent" : "normal", summary: "", source: "mock" };
}

// ---------- how similar cases ended in court (tables built by tools/outcomes) ----------

function similarCases(market, categoryId, factors, lang) {
  const file = join(ROOT, "engine", "outcomes", `${market}.json`);
  if (!existsSync(file)) return null;
  let table;
  try { table = JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
  const c = table.categories?.[categoryId];
  if (!c) return null;
  const labels = Object.fromEntries(caseType(categoryId).factors.map((f) => [f.id, f.label[lang]]));
  return {
    n: c.n, years: c.years, winPct: c.winPct, contestedWinPct: c.contestedWinPct,
    medianAwarded: c.medianAwarded, medianAwardedOfClaim: c.medianAwardedOfClaim, source: table.source,
    factors: Object.entries(c.factors || {}).filter(([id]) => labels[id]).map(([id, f]) => ({
      id, label: labels[id], personHas: factors.find((x) => x.id === id)?.ok ?? null, withPct: f.withPct, withoutPct: f.withoutPct,
    })),
  };
}

// ---------- the decisions Jeff makes (English options; Jeff reads Japanese and Chinese input) ----------

const NEED = {
  now: "Serious or urgent: large money, injury, court papers, a deadline, a signature request, dismissal or police are involved, so the person should talk to a lawyer now",
  consult: "A real legal problem that is worth a free consultation with a lawyer",
  self: "Small or simple: the person can likely handle it alone or with free public help",
};
const OUTLOOK = {
  good: "With a lawyer's help the person is likely to get a good result: the facts and evidence favour them",
  mixed: "Uncertain: some facts help the person and some hurt them",
  weak: "Even with a lawyer the person is unlikely to get much: weak evidence, a very small amount, or too late",
};
const ALONE = {
  good: "Handling it alone without a lawyer, the person is likely to get a good result: the other side will probably pay, agree or back down",
  mixed: "Handling it alone, the result is uncertain",
  weak: "Handling it alone, the person is unlikely to get much: without a lawyer the other side will likely ignore, delay or fight them",
};
const LEVEL = { now: "high", consult: "medium", self: "low" };

function decisionsFor(categoryId) {
  return [
    { id: "need", labels: NEED },
    { id: "outlook", labels: OUTLOOK },
    { id: "alone", labels: ALONE },
    ...caseType(categoryId).factors.map((f) => ({ id: "f_" + f.id, labels: { yes: f.yes, no: f.no } })),
  ];
}

async function jeffJudge(text, decisions) {
  if (!JEFF_URL) return null;
  try {
    const res = await fetch(JEFF_URL.replace(/\/classify$/, "/judge"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, decisions }), signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Same decisions answered by the AI, used only when Jeff is off.
async function aiJudge(text, decisions) {
  if (MOCK) return mockJudge(text, decisions);
  try {
    const spec = decisions.map((d) => `"${d.id}": one of ${Object.keys(d.labels).map((k) => `"${k}" (${d.labels[k]})`).join(", ")}`).join("\n");
    const out = await llmJSON(GUARDRAILS, `For this case, give a probability (0-1, summing to 1) for each option of each decision.
${spec}
Return JSON: {"<decision id>": {"<option>": probability, ...}, ...}
Case: """${text}"""`);
    STATUS.aiOk++;
    const decisionsOut = {};
    for (const d of decisions) {
      const probs = Object.fromEntries(Object.keys(d.labels).map((k) => [k, Number(out[d.id]?.[k]) || 0]));
      const total = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
      for (const k in probs) probs[k] /= total;
      const value = Object.keys(probs).reduce((a, b) => (probs[a] >= probs[b] ? a : b));
      decisionsOut[d.id] = { value, confidence: probs[value], probabilities: probs };
    }
    return { decisions: decisionsOut, urgency: null };
  } catch (e) { aiFailed("judge", e); return mockJudge(text, decisions); }
}

function mockJudge(text, decisions) {
  const serious = /裁判所|法院|サイン|签字|簽名|解雇|解僱|辞退|逮捕|骨折|140万|150萬|20万元以上/.test(text);
  const out = {};
  for (const d of decisions) {
    const keys = Object.keys(d.labels);
    const value = d.id === "need" ? (serious ? "now" : "consult") : d.id === "outlook" ? "mixed" : d.id === "alone" ? "weak" : "yes";
    const probs = Object.fromEntries(keys.map((k) => [k, k === value ? 0.6 : 0.4 / (keys.length - 1)]));
    out[d.id] = { value, confidence: 0.6, probabilities: probs };
  }
  return { decisions: out, urgency: serious ? 0.75 : 0.25 };
}

// ---------- API handlers ----------

async function loadPack(market, name) {
  return JSON.parse(await readFile(join(ROOT, "case-packs", market, `${name}.json`), "utf8"));
}

// Step 1: which kind of problem, and the tap questions for it. Jeff decides the type when it is sure.
async function triage({ market = "jp", text = "" }) {
  const m = MARKETS[market] ? market : "jp";
  const lang = MARKETS[m].lang;
  const clean = redact(text);
  const [cls, jeff] = await Promise.all([classify(clean, lang), jeffClassify(clean)]);
  const useJeff = jeff && jeff.confidence >= 0.5 && jeff.category !== "other";
  const cat = categoryById(useJeff ? jeff.category : cls.category);

  let followups, deep = false;
  if (cat.deepPack) {
    deep = true;
    const pack = await loadPack(m, cat.deepPack);
    followups = pack.questions
      .filter((q) => !["story", "region"].includes(q.id))
      .map((q) => ({ id: q.id, text: q.text, help: q.help, show_if: q.show_if, options: q.options }));
  } else {
    const own = caseType(cat.id).questions.map((q) => ({
      id: q.id, text: q.text[lang], options: q.options[lang].map((o) => ({ value: o, label: o })),
    }));
    const shared = FOLLOWUPS[lang]
      .filter((q) => cat.money || q.id !== "amount")
      .map((q) => ({ id: q.id, text: q.text, options: q.options.map((o) => ({ value: o, label: o })) }));
    followups = [...own, ...shared];
  }
  return {
    market: m, category: cat.id, categoryLabel: cat[lang], categoryBy: useJeff ? "quick" : "ai",
    aiCategory: cls.category, urgency: cls.urgency, summary: cls.summary || "", deep, followups, mock: MOCK,
    quick: jeff ? { category: jeff.category, confidence: jeff.confidence } : null,
  };
}

// The person's story plus their taps, as one text Jeff and the AI read.
function caseText(clean, followups, answers) {
  const lines = (followups || []).filter((q) => answers[q.id] != null).map((q) => {
    const o = (q.options || []).find((x) => x.value === answers[q.id]);
    return `- ${q.text} ${o ? o.label : answers[q.id]}`;
  });
  return lines.length ? `${clean}\n\n${lines.join("\n")}` : clean;
}

// Step 2: Jeff decides. Fast: no AI writing here.
async function judge({ market = "jp", text = "", category = "other", answers = {}, followups = [], consent = false, aiCategory = null, quickCategory = null }) {
  const m = MARKETS[market] ? market : "jp";
  const mk = MARKETS[m];
  const lang = mk.lang;
  const cat = categoryById(category);
  const ct = caseType(cat.id);
  const clean = redact(text);
  const full = caseText(clean, followups, answers);
  const decisions = decisionsFor(cat.id);

  const t0 = Date.now();
  let raw = await jeffJudge(full, decisions);
  const source = raw ? "quick" : "ai";
  if (!raw) raw = await aiJudge(full, decisions);
  const seconds = Math.max(0.1, Math.round((Date.now() - t0) / 100) / 10);
  const d = raw.decisions || {};

  const need = d.need || { value: "consult", confidence: 0.5 };
  const outlook = d.outlook || { probabilities: { good: 0.5 } };
  const alone = d.alone || { probabilities: { good: 0.3 } };
  // Turn Jeff's three levels into one score: good counts fully, uncertain half, difficult zero.
  const score = (p, dflt) => (p ? Math.round(((p.good ?? 0) + 0.5 * (p.mixed ?? 0)) * 100) : dflt);
  const withPct = score(outlook.probabilities, 50);
  // A lawyer can't make the result worse than handling it alone, so "alone" is capped at "with a lawyer".
  const alonePct = Math.min(withPct, score(alone.probabilities, 30));
  const factors = ct.factors.map((f) => {
    const r = d["f_" + f.id] || { value: "yes", probabilities: { yes: 0.5 } };
    return { id: f.id, label: f.label[lang], ok: r.value === "yes", pct: Math.round((r.probabilities?.[r.value] ?? r.confidence ?? 0.5) * 100) };
  });
  const urgency = raw.urgency;
  const urgencyLevel = urgency == null ? null : urgency >= 0.66 ? 2 : urgency >= 0.33 ? 1 : 0;

  // Money at stake: the lawyer pack's table when there is one, otherwise the person's own amount band.
  let money = null, band = null, packOut = null;
  if (cat.deepPack) {
    const pack = await loadPack(m, cat.deepPack);
    packOut = await runCheck(pack, { ...answers, story: clean });
    if (packOut.range) {
      money = { text: `${packOut.range.min}〜${packOut.range.max}${packOut.range.unit}`, note: packOut.rangeLabel + "（" + packOut.range.label + "）" };
      if (packOut.range.unit.includes("万円")) band = [packOut.range.min, packOut.range.max];
    } else if (packOut.value?.text) money = { text: packOut.value.text, note: "" };
  } else if (answers.amount) {
    money = { text: answers.amount, note: "" };
  }
  const amountIndex = FOLLOWUPS[lang][0].options.indexOf(answers.amount);
  const fee = estimateFee(m, cat.id, amountIndex >= 0 && amountIndex < 4 ? amountIndex : -1, band);

  const out = {
    id: Math.random().toString(36).slice(2, 10),
    category: cat.id, categoryLabel: cat[lang], deep: !!cat.deepPack, source, seconds,
    level: LEVEL[need.value] || "medium",
    headline: COPY[lang].levels[LEVEL[need.value] || "medium"],
    need: { value: need.value, pct: Math.round((need.confidence ?? 0.5) * 100) },
    outlook: { pct: withPct, value: outlook.value || "mixed" }, alone: { pct: alonePct },
    factors, urgency: urgencyLevel,
    money, fee, help: ct.help[lang], similar: similarCases(m, cat.id, factors, lang),
    free: mk.cost + (cat.id === "traffic" && m === "jp" ? "ご自身やご家族の自動車保険に「弁護士費用特約」があれば、費用の自己負担がないことも多いです。" : ""),
    packWarnings: packOut?.warnings || [],
    supervision: mk.supervision, disclaimer: mk.disclaimer, draft: true, mock: MOCK,
  };
  if (consent) {
    await log({ type: "check", id: out.id, market: m, category: cat.id, aiCategory, jeffCategory: quickCategory, source,
      need: out.need, outlook: out.outlook.pct, alone: alonePct, factors: factors.map((f) => [f.id, f.ok]), urgency: urgencyLevel,
      answers, seconds, mock: MOCK });
  }
  return out;
}

// Step 3: the AI explains Jeff's result in plain words. It may not change the verdict.
async function explain({ market = "jp", text = "", answers = {}, followups = [], verdict = {} }) {
  const m = MARKETS[market] ? market : "jp";
  const lang = MARKETS[m].lang;
  const full = caseText(redact(text), followups, answers);
  const NEED_EN = { now: "see a lawyer now", consult: "worth a free consultation with a lawyer", self: "can likely handle it alone" };
  const facts = {
    problem: verdict.categoryLabel,
    lawyer_needed: NEED_EN[verdict.need?.value] || verdict.need?.value,
    outlook_good_result_with_lawyer_pct: verdict.outlook?.pct,
    outlook_good_result_alone_pct: verdict.alone?.pct,
    checks: (verdict.factors || []).map((f) => ({ id: f.id, check: f.label, result: f.ok ? "yes (strength)" : "no (weak point)" })),
    money: verdict.money?.text, typical_fee: verdict.fee?.text, fee_may_exceed_amount: !!verdict.fee?.small,
    similar_court_cases: verdict.similar ? { decisions: verdict.similar.n, claimant_won_all_or_part_pct: verdict.similar.winPct,
      by_fact: verdict.similar.factors.map((f) => ({ fact: f.label, person_has_it: f.personHas, won_pct_with: f.withPct, won_pct_without: f.withoutPct })) } : null,
  };
  if (MOCK) return mockExplain(lang, verdict);
  try {
    const out = await llmJSON(GUARDRAILS, `Jeff, our decision engine, already judged this case. Your only job: tell the person, in ${lang}, the reason for each of Jeff's results.
Rules: never mention "Jeff", any engine, model or AI by name — call it "this check" if needed; base every reason on what the person actually wrote or tapped (quote their facts briefly); never change or contradict Jeff's result;
never add a new percentage or probability (you may mention the court statistics given); if their description gives no information for a result, say what information is missing.
Jeff's results: ${JSON.stringify(facts)}
The person's case: """${full}"""
Return JSON:
{"need": one or two sentences: why Jeff judged "${facts.lawyer_needed}",
 "outlook": one or two sentences: which of their facts raise and which lower the outlook (${facts.outlook_good_result_alone_pct}% on their own, ${facts.outlook_good_result_with_lawyer_pct}% with a lawyer),
 "alone": one or two sentences: what a lawyer concretely adds in this case that explains the difference between ${facts.outlook_good_result_alone_pct}% and ${facts.outlook_good_result_with_lawyer_pct}%,
 "checks": {${facts.checks.map((c) => `"${c.id}": one short sentence why this check is ${c.result.split(" ")[0]}`).join(", ")}},
 "steps": exactly 3 short things to do this week that would improve the weak points, most important first}`);
    STATUS.aiOk++;
    const checks = {};
    for (const c of facts.checks) checks[c.id] = String(out.checks?.[c.id] || "");
    return { reasons: { need: String(out.need || ""), outlook: String(out.outlook || ""), alone: String(out.alone || ""), checks }, steps: (out.steps || []).slice(0, 3).map(String) };
  } catch (e) { aiFailed("explain", e); return mockExplain(lang, verdict); }
}

function mockExplain(lang, v) {
  const t = {
    ja: { need: "記載された内容と回答から判定しました。", ok: "回答からこの点は満たしていると判断しました。", ng: "回答からはこの点が確認できませんでした。", steps: ["証拠（書面・やりとり・写真）を保存する", "内容に納得するまで何にもサインしない", "無料相談で弁護士に確認する"] },
    "zh-Hant": { need: "依您填寫的內容與回答判斷。", ok: "依您的回答，這一點成立。", ng: "從您的回答無法確認這一點。", steps: ["保存證據（書面・對話・照片）", "確認前不要簽署任何文件", "利用免費諮詢向律師確認"] },
    "zh-Hans": { need: "根据您填写的内容与回答判断。", ok: "根据您的回答，这一点成立。", ng: "从您的回答无法确认这一点。", steps: ["保存证据（书面・聊天记录・照片）", "确认前不要签署任何文件", "利用免费咨询向律师确认"] },
  }[lang];
  const checks = Object.fromEntries((v.factors || []).map((f) => [f.id, f.ok ? t.ok : t.ng]));
  return { reasons: { need: t.need, outlook: t.need, alone: "", checks }, steps: t.steps };
}

// Rough "how similar cases usually end", from a quick web search (until we license court databases).
// Only general terms are searched — never the person's details. About 1–3 searches ($0.01–0.03) per check.
const COUNTRY = { jp: { country: "JP", city: "Tokyo", timezone: "Asia/Tokyo", where: "Japan" },
  tw: { country: "TW", city: "Taipei", timezone: "Asia/Taipei", where: "Taiwan" },
  cn: { country: "CN", city: "Shanghai", timezone: "Asia/Shanghai", where: "mainland China" } };

async function webSimilar({ market = "jp", category = "other", verdict = {} }) {
  const m = MARKETS[market] ? market : "jp";
  const lang = MARKETS[m].lang, loc = COUNTRY[m];
  if (MOCK || !WEB_SEARCH || category === "other") return null;
  const cat = categoryById(category);
  const facts = (verdict.factors || []).map((f) => `${f.label}: ${f.ok ? "yes" : "no"}`).join("; ");
  const prompt = `Search the web (in the local language of ${loc.where}) for how "${cat[lang]}" disputes (${category}) usually end for individuals in ${loc.where}:
court statistics, judgment summaries, or law firm articles with outcome figures. Use only general terms in your searches — no personal details.
Key facts of this case type to consider: ${facts || "none"}.
Then answer with JSON only:
{"pct": rough share (0-100) of such cases where the individual got all or part of what they claimed, or null if the sources give no basis,
 "typical": short phrase in ${lang} on typical amount or result, or null,
 "basis": one sentence in ${lang} saying what the estimate is based on (e.g. "court statistics 2023", "several law firm articles"),
 "confidence": "low" or "medium"}`;
  try {
    let messages = [{ role: "user", content: prompt }], data;
    for (let turn = 0; turn < 3; turn++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3,
            user_location: { type: "approximate", country: loc.country, city: loc.city, timezone: loc.timezone } }] }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
      data = await res.json();
      if (data.stop_reason !== "pause_turn") break;
      messages = [...messages, { role: "assistant", content: data.content }];
    }
    const texts = (data.content || []).filter((b) => b.type === "text");
    const text = texts.map((b) => b.text).join("");
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("web search reply had no JSON");
    const out = JSON.parse(text.slice(a, b + 1));
    const sources = [];
    for (const blk of texts) for (const c of blk.citations || []) {
      if (c.url && !sources.some((s) => s.url === c.url)) sources.push({ url: c.url, title: c.title || c.url });
    }
    if (!sources.length) for (const blk of data.content || []) if (blk.type === "web_search_tool_result" && Array.isArray(blk.content)) {
      for (const r of blk.content.slice(0, 3)) if (r.url && !sources.some((s) => s.url === r.url)) sources.push({ url: r.url, title: r.title || r.url });
    }
    STATUS.aiOk++;
    const pct = Number.isFinite(Number(out.pct)) && out.pct !== null ? Math.max(0, Math.min(100, Math.round(Number(out.pct)))) : null;
    if (pct == null && !out.typical) return null;
    return { pct, typical: out.typical || null, basis: String(out.basis || ""), confidence: out.confidence === "medium" ? "medium" : "low", sources: sources.slice(0, 4) };
  } catch (e) { aiFailed("web search", e); return null; }
}

// Optional: the person adds photos or PDFs (contract, letter, chat screenshots). The AI reads them and returns a short
// summary of the facts that matter, which the person sees and can edit. The files are never stored.
const DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
async function readDocs({ market = "jp", files = [] }) {
  const m = MARKETS[market] ? market : "jp";
  const lang = MARKETS[m].lang;
  const ok = (files || []).filter((f) => DOC_TYPES.includes(f.type) && typeof f.data === "string").slice(0, 5);
  if (!ok.length) return { summary: "", count: 0 };
  if (MOCK) return { summary: { ja: "（テストモード：書類の要約がここに入ります）", "zh-Hant": "（測試模式：文件摘要會顯示在這裡）", "zh-Hans": "（测试模式：文件摘要会显示在这里）" }[lang], count: ok.length, used: ok.length, skipped: 0 };
  const blocks = ok.map((f) => f.type === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
    : { type: "image", source: { type: "base64", media_type: f.type, data: f.data } });
  try {
    const out = await llmJSON(GUARDRAILS, [...blocks, { type: "text", text: `A person uploaded these ${ok.length} files (in order) to a free legal pre-check about their own problem.
First decide for each file whether it is related to a legal problem: related = a contract, letter, notice, invoice, receipt,
transfer or bank record, court or police paper, medical certificate, chat or email screenshot about a dispute, or a photo
showing damage, injury, an accident scene or the condition of a room or item. Unrelated = selfies, people, scenery, food,
memes, ads, blank or unreadable images, or screenshots with nothing to do with a dispute.
Do not describe unrelated files at all.
Then, using only the related files, write in ${lang} a short factual summary of what matters for the problem: what each
document is, dates, amounts, deadlines, what was promised or demanded, signatures. Never write personal names, addresses,
phone numbers or ID numbers — say "相手方/对方/the other party", "本人/我" instead.
Return JSON: {"related": [true or false for each file, in order], "summary": "at most 6 short lines, each starting with ・, or empty if no file is related"}` }]);
    STATUS.aiOk++;
    const related = ok.map((_, i) => out.related?.[i] !== false);
    const used = related.filter(Boolean).length;
    return { summary: used ? redact(String(out.summary || "")).slice(0, 800) : "", count: ok.length, used, skipped: ok.length - used };
  } catch (e) { aiFailed("docs", e); return { summary: "", count: ok.length, used: 0, skipped: 0, error: true }; }
}

// Old single-call API (used by tests): judge + explain together.
async function report(body) {
  const verdict = await judge(body);
  const ex = await explain({ ...body, verdict });
  return { ...verdict, ...ex };
}

// "Have a lawyer review my case": records the request (no contact details are collected in the test).
async function lawyerRequest({ id, market, category }) {
  await log({ type: "lawyer_request", id, market, category });
  return { ok: true };
}

async function feedback({ id, helpful, wanted }) {
  await log({ type: "feedback", id, helpful, wanted });
  return { ok: true };
}

async function log(rec) {
  await mkdir(dirname(LOG_FILE), { recursive: true });
  await appendFile(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), ...rec }) + "\n");
}

// ---------- http ----------

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css" };
async function status() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy || "";
  return { ai: MOCK ? "test mode (no key)" : MODEL, quickEngine: JEFF_URL ? "on" : "off", webSearch: WEB_SEARCH && !MOCK, password: !!SITE_PASSWORD,
    proxyEnv: proxy ? proxy.replace(/\/\/[^@]*@/, "//***@") : "none", nodeUsesProxy: process.env.NODE_USE_ENV_PROXY === "1",
    node: process.version, ...STATUS };
}

const ROUTES = { "/api/triage": triage, "/api/judge": judge, "/api/explain": explain, "/api/report": report,
  "/api/request": lawyerRequest, "/api/docs": readDocs, "/api/similar": webSimilar, "/api/feedback": feedback, "/api/status": status };

export const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Jeff 2 team test", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Team password required / チームパスワードが必要です / 需要团队密码");
    }
    const url = new URL(req.url, "http://x");
    if ((req.method === "POST" || url.pathname === "/api/status") && ROUTES[url.pathname]) {
      let body = "";
      const max = url.pathname === "/api/docs" ? 25_000_000 : 20000; // documents are sent as images/PDF
      for await (const chunk of req) { body += chunk; if (body.length > max) throw new Error("too large"); }
      const out = await ROUTES[url.pathname](JSON.parse(body || "{}"));
      res.writeHead(200, { "Content-Type": TYPES[".json"] });
      return res.end(JSON.stringify(out));
    }
    if (url.pathname === "/" || url.pathname === "/web") { res.writeHead(302, { Location: "/web/" }); return res.end(); }
    let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    if (!/^\/web\//.test(path) && path !== "/engine/copy.js") { res.writeHead(404); return res.end(); } // never serve engine internals
    const file = await readFile(join(ROOT, path));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(file);
  } catch (e) {
    const status = e.code === "ENOENT" ? 404 : 500;
    if (status === 500) console.error(e);
    res.writeHead(status, { "Content-Type": TYPES[".json"] });
    res.end(JSON.stringify({ error: status === 404 ? "not found" : "server error" }));
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Jeff 2 running at http://localhost:${PORT}/web/`);
    console.log(`  AI:   ${MOCK ? "TEST MODE (no ANTHROPIC_API_KEY in .env)" : MODEL}`);
    console.log(`  Jeff: ${JEFF_URL || "off (set JEFF_DIR in .env to turn it on)"}`);
    console.log(`  Team password: ${SITE_PASSWORD ? "on" : "off"}`);
  });
}
