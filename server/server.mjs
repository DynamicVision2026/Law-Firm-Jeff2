// Jeff 2 server — serves the web page and the three API calls.
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
    .slice(0, 1500)
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
async function llmJSON(system, user) {
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
  housing: "Renting or housing: deposits, move-out charges, eviction, landlord problems",
  consumer: "Consumer problems, refunds, contracts with businesses, scams and fraud",
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

async function lightReport(text, lang, category, answers) {
  if (MOCK) return mockLight(lang, answers);
  try { const r = await lightReportLLM(text, lang, category, answers); STATUS.aiOk++; return r; }
  catch (e) { aiFailed("report", e); return mockLight(lang, answers); }
}

async function lightReportLLM(text, lang, category, answers) {
  const out = await llmJSON(
    GUARDRAILS,
    `Write a short pre-check report in ${lang} for a person with a "${category}" problem.
Their description: """${text}"""
Their answers: ${JSON.stringify(answers)}
Return JSON:
{"level": "high"|"medium"|"low"  (how strongly a lawyer consultation is recommended; high if large money, court papers, deadlines or signature requests),
 "at_stake": one sentence on what money or rights are at stake, using their amount band if given (no exact predictions),
 "key_points": exactly 3 short sentences on the facts that usually matter in cases like this (general, not a verdict),
 "warnings": up to 2 short warnings only if clearly relevant (e.g. limitation periods, do not sign yet, keep evidence),
 "next_step": one or two sentences on a sensible next step, including self-help options when the amount is small}`
  );
  if (!["high", "medium", "low"].includes(out.level)) out.level = "medium";
  return out;
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
function mockLight(lang, a) {
  const big = /140万|150萬|20万元以上|60〜140/.test(a.amount || "");
  const court = /裁判所|法院|サイン|签字|簽名/.test(a.other_side || "");
  const level = court || big ? "high" : /お金の問題ではない|不是/.test(a.amount || "") ? "low" : "medium";
  const t = {
    ja: { at: a.amount || "不明", kp: ["証拠（書面・やりとり・振込記録）の有無が結果を大きく左右します。", "請求できる期間（時効）があるため、時間がたつほど不利になることがあります。", "金額が小さい場合は、少額訴訟など自分でできる方法もあります。"], ns: "証拠を整理し、早めに専門家に確認しましょう。" },
    "zh-Hant": { at: a.amount || "不明", kp: ["是否有證據（書面、對話、轉帳紀錄）會大幅影響結果。", "請求權有時效，時間拖越久可能越不利。", "金額較小時，也可以考慮小額訴訟等自行處理的方式。"], ns: "請先整理證據，並儘早向專業人士確認。" },
    "zh-Hans": { at: a.amount || "不明", kp: ["是否有证据（书面材料、聊天记录、转账记录）会很大程度影响结果。", "诉讼时效有限，拖得越久可能越不利。", "金额较小时，也可以考虑小额诉讼等自行处理的方式。"], ns: "请先整理证据，并尽早向专业人士确认。" },
  }[lang];
  return { level, at_stake: t.at, key_points: t.kp, warnings: [], next_step: t.ns };
}

// ---------- API handlers ----------

async function loadPack(market, name) {
  return JSON.parse(await readFile(join(ROOT, "case-packs", market, `${name}.json`), "utf8"));
}

async function triage({ market = "jp", text = "" }) {
  const m = MARKETS[market] ? market : "jp";
  const lang = MARKETS[m].lang;
  const clean = redact(text);
  const [cls, jeff] = await Promise.all([classify(clean, lang), jeffClassify(clean)]);
  const cat = categoryById(cls.category);

  let followups, deep = false;
  if (cat.deepPack) {
    deep = true;
    const pack = await loadPack(m, cat.deepPack);
    followups = pack.questions
      .filter((q) => !["story", "region"].includes(q.id))
      .map((q) => ({ id: q.id, text: q.text, help: q.help, show_if: q.show_if, options: q.options }));
  } else {
    followups = FOLLOWUPS[lang].map((q) => ({ id: q.id, text: q.text, options: q.options.map((o) => ({ value: o, label: o })) }));
  }
  return {
    market: m, category: cat.id, categoryLabel: cat[lang], urgency: cls.urgency, summary: cls.summary || "",
    deep, followups, mock: MOCK, jeff,
  };
}

async function report({ market = "jp", text = "", category = "other", answers = {}, consent = false, jeff = null }) {
  const m = MARKETS[market] ? market : "jp";
  const mk = MARKETS[m];
  const lang = mk.lang;
  const copy = COPY[lang];
  const cat = categoryById(category);
  const clean = redact(text);
  let out;

  if (cat.deepPack) {
    const pack = await loadPack(m, cat.deepPack);
    const r = await runCheck(pack, { ...answers, story: clean });
    out = {
      deep: true, level: r.judgment.recommendation, headline: r.headline,
      atStake: r.value?.text || "", range: r.range ? { ...r.range, label: r.rangeLabel + "（" + r.range.label + "）" } : null,
      reasons: r.reasons, warnings: r.warnings, nextStep: r.nextStep,
      cost: r.cost || mk.cost, supervision: r.supervision, disclaimer: r.disclaimer, draft: pack.meta.status !== "approved",
    };
  } else {
    const r = await lightReport(clean, lang, cat.id, answers);
    out = {
      deep: false, level: r.level, headline: copy.levels[r.level],
      atStake: r.at_stake, range: null, reasons: (r.key_points || []).slice(0, 3),
      warnings: (r.warnings || []).slice(0, 2).map((t) => ({ level: "medium", text: t })),
      nextStep: r.next_step, cost: mk.cost, supervision: mk.supervision, disclaimer: mk.disclaimer, draft: true,
    };
  }
  out.categoryLabel = cat[lang];
  out.id = Math.random().toString(36).slice(2, 10);

  if (consent) {
    await log({ type: "check", id: out.id, market: m, category: cat.id, deep: out.deep, level: out.level,
      answers, jeffCategory: jeff?.category ?? null, jeffConfidence: jeff?.confidence ?? null, mock: MOCK });
  }
  return out;
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
  return { ai: MOCK ? "test mode (no key)" : MODEL, jeff: JEFF_URL || "off", password: !!SITE_PASSWORD,
    proxyEnv: proxy ? proxy.replace(/\/\/[^@]*@/, "//***@") : "none", nodeUsesProxy: process.env.NODE_USE_ENV_PROXY === "1",
    node: process.version, ...STATUS };
}

const ROUTES = { "/api/triage": triage, "/api/report": report, "/api/feedback": feedback, "/api/status": status };

export const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Jeff 2 team test", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Team password required / チームパスワードが必要です / 需要团队密码");
    }
    const url = new URL(req.url, "http://x");
    if ((req.method === "POST" || url.pathname === "/api/status") && ROUTES[url.pathname]) {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 20000) throw new Error("too large"); }
      const out = await ROUTES[url.pathname](JSON.parse(body || "{}"));
      res.writeHead(200, { "Content-Type": TYPES[".json"] });
      return res.end(JSON.stringify(out));
    }
    if (url.pathname === "/" || url.pathname === "/web") { res.writeHead(302, { Location: "/web/" }); return res.end(); }
    let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    if (!/^\/(web|engine|case-packs)\//.test(path)) { res.writeHead(404); return res.end(); }
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
