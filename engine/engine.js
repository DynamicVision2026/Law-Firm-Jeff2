// Jeff 2 engine — turns form answers into a simple result.
// Three layers:
//   1. Judge      -> recommendation level, value tier, urgency, key factors
//                    (Jeff model when configured, otherwise the pack's lawyer rules)
//   2. Calculator -> estimated money range from the pack's table
//   3. Templates  -> lawyer-written sentences for headline, reasons, warnings, next step, cost
// Works in the browser and in Node (for tests). No dependencies.

// ---------- helpers ----------

// A condition is { questionId: value } or { questionId: [value, value] }.
// All keys must match.
export function matches(cond, answers) {
  return Object.entries(cond).every(([id, want]) => {
    const got = answers[id];
    return Array.isArray(want) ? want.includes(got) : got === want;
  });
}

// Questions shown to the user, respecting show_if.
export function visibleQuestions(pack, answers) {
  return pack.questions.filter((q) => !q.show_if || matches(q.show_if, answers));
}

// ---------- layer 1: judge ----------

// Rule-based judge, written by the lawyers in pack.rules.
export function ruleJudge(pack, answers) {
  const r = pack.rules;
  let score = 0;
  for (const s of r.score) if (matches(s.if, answers)) score += s.add;

  const level = (t) => (score >= t.high ? "high" : score >= t.medium ? "medium" : "low");
  const factors = r.factors.filter((f) => matches(f.if, answers)).map((f) => f.factor);
  const urgent = r.urgency.some((u) => matches(u.if, answers));

  return {
    source: "rules",
    recommendation: level(r.recommendation_levels),
    value: level(r.value_levels || r.recommendation_levels),
    urgency: urgent ? "urgent" : "normal",
    factors: factors.slice(0, 3),
    score,
    confidence: null,
  };
}

// Jeff judge: calls a small local Jeff service if one is configured.
// Expected service contract (simple JSON):
//   POST { text, question, options, multi } -> { probabilities: { option: p } }
// Falls back to the rule judge on any error, and sends low-confidence
// results to lawyer review (pack.jeff.review_threshold).
export async function jeffJudge(pack, answers, jeffUrl) {
  const base = ruleJudge(pack, answers);
  if (!jeffUrl) return base;

  const text = describeCase(pack, answers);
  const ask = async (spec) => {
    const res = await fetch(jeffUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, question: spec.question, options: spec.options, multi: !!spec.multi }),
    });
    if (!res.ok) throw new Error("jeff " + res.status);
    return (await res.json()).probabilities;
  };
  const top = (p) => Object.entries(p).sort((a, b) => b[1] - a[1])[0];

  try {
    const rec = await ask(pack.jeff.recommendation);
    const urg = await ask(pack.jeff.urgency);
    const fac = await ask(pack.jeff.factors);
    const [recLabel, recP] = top(rec);
    return {
      ...base,
      source: "jeff",
      recommendation: recLabel,
      urgency: top(urg)[0],
      factors: Object.entries(fac).filter(([, p]) => p >= 0.5).sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 3),
      confidence: recP,
      needs_review: recP < (pack.jeff.review_threshold ?? 0.6),
      rules_view: base, // kept for the lawyers' accuracy comparison
    };
  } catch {
    return base;
  }
}

// Plain-text description of the answers, used as Jeff's input.
export function describeCase(pack, answers) {
  const lines = [];
  for (const q of visibleQuestions(pack, answers)) {
    const a = answers[q.id];
    if (a === undefined || a === "") continue;
    const opt = q.options?.find((o) => o.value === a);
    lines.push(`${q.text} ${opt ? opt.label : a}`);
  }
  return lines.join("\n");
}

// ---------- layer 2: calculator ----------

export function calculate(pack, answers) {
  const c = pack.calculator;
  if (!c || (c.applies_if && !matches(c.applies_if, answers))) return null;
  const key = answers[c.table_key];
  const table = Object.values(c.tables).find((t) => !t.used_for || t.used_for.includes(answers[c.table_select ?? "injury_type"]));
  const range = table?.ranges[key];
  if (!range) return null;
  return { min: range[0], max: range[1], unit: c.unit, label: table.label, basis: c.basis, note: c.note };
}

// ---------- layer 3: templates ----------

export function buildResult(pack, answers, judgment) {
  const t = pack.result;
  return {
    market: pack.meta.market,
    caseType: pack.meta.case_type,
    status: pack.meta.status,
    headline: t.headline[judgment.recommendation],
    value: t.value_label ? { label: t.value_label, text: t.value[judgment.value] } : null,
    range: calculate(pack, answers),
    rangeLabel: t.range_label,
    reasons: judgment.factors.map((f) => pack.factors[f]).filter(Boolean),
    warnings: pack.warnings.filter((w) => matches(w.if, answers)).map((w) => ({ level: w.level, text: w.text })),
    urgent: judgment.urgency === "urgent",
    nextStep: t.next_step[judgment.recommendation],
    cost: t.cost_note || null,
    supervision: t.supervision_label,
    disclaimer: t.disclaimer,
    judgment,
  };
}

// ---------- one call ----------

export async function runCheck(pack, answers, { jeffUrl } = {}) {
  const judgment = await jeffJudge(pack, answers, jeffUrl);
  return buildResult(pack, answers, judgment);
}

// Anonymized log record (no free text stored by default).
export function logRecord(pack, answers, result) {
  const { story, ...structured } = answers;
  return {
    at: new Date().toISOString(),
    market: pack.meta.market,
    caseType: pack.meta.case_type,
    packStatus: pack.meta.status,
    answers: structured,
    hasStory: !!story,
    recommendation: result.judgment.recommendation,
    value: result.judgment.value,
    urgency: result.judgment.urgency,
    factors: result.judgment.factors,
    source: result.judgment.source,
    confidence: result.judgment.confidence,
  };
}
