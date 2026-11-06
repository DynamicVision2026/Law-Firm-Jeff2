# Jeff 2 — Free Legal Pre-Check (MVP, Stage 1)

**A legal "pre-visit check", like a symptom checker before seeing a doctor.**
A person describes their problem in their own words (no names or contact
details). AI sorts it into one of 16 problem types, asks a few tap-to-answer
questions, and gives a short report: what's at stake, what help costs, the
points that matter, warnings, and the next step. Lawyers are the doctors; law
firms are the hospitals (Stage 2).

**North star:** make individuals want to share their case.
Every change is checked against [docs/north-star.md](docs/north-star.md).

**Stage 1 goal:** prove that people use the check, find it helpful, and that
the screening agrees with lawyers' judgment. Law-firm delivery comes in Stage 2.

## How it works

```
"What happened?"  (own words, with writing hints, or 5 guided questions)
        │
  AI classifies → 16 categories + urgency      (LLM; Jeff compared in parallel when JEFF_URL is set)
        │
  Follow-up questions, one per screen          (lawyer pack questions, or 4 universal questions)
        │
  Report: money & cost first, key points, warnings, next step
     - deep report: categories with a lawyer pack (traffic now)
     - light report: every other category (AI, inside lawyer guardrails)
        │
  Anonymized log (no free text) + "helpful? / what did you want most?" feedback
```

## Repository layout

```
case-packs/        Deep lawyer packs, one file per market + case type (no coding)
engine/            engine.js (judge + calculator + templates), categories.js (16 types,
                   cost help per market), copy.js (all interface text, 3 languages)
server/            server.mjs — web page + API (triage, report, feedback), privacy redaction
jeff-bridge/       bridge.py — connects Jeff's triage adapter (runs inside your Jeff folder)
web/               The pre-check page (one question per screen)
docs/              north-star.md, case-pack-guide.md
tests/             engine + server tests
```

## Markets (MVP)

| Market | Language | Coverage |
|---|---|---|
| Japan (jp) | Japanese | All 16 categories (light report); traffic deep report with amount estimate |
| Taiwan (tw) | Traditional Chinese | All 16 categories; traffic deep report (amount table pending) |
| Mainland China (cn) | Simplified Chinese | All 16 categories; traffic deep report (amount table pending) |
| Hong Kong (hk) | Traditional Chinese + English | Later |

## Status

- [x] Free-text entrance with writing hints, examples and a 5-question guided mode
- [x] AI classification into 16 categories (test mode works without a key)
- [x] One-question-per-screen follow-ups; deep report (traffic) + light report (all others)
- [x] Japanese, Traditional Chinese (Taiwan), Simplified Chinese (mainland)
- [x] Privacy: contact details removed, free text never stored; anonymized log; feedback
- [ ] Add AI key and test real classification quality
- [ ] Jeff service, compared against the AI classification
- [ ] Lawyer review of all drafts; amount tables for Taiwan and mainland
- [ ] More deep packs, chosen by what the log shows people bring most
- [ ] Hosting (mainland China needs a separate local deployment)

## Run it on your Mac

Step-by-step guide: [docs/setup-mac.md](docs/setup-mac.md). In short: put your Anthropic key and your
Jeff folder in `.env` (never uploaded), then double-click **Start Jeff2.command**.

For developers:
```
node server/server.mjs                         # reads .env; test mode if no key
uv run --project /path/to/jeff python jeff-bridge/bridge.py   # Jeff connector on :8790
node tests/engine.test.mjs && node tests/server.test.mjs
```

## Ground rules (all markets)

- General information and estimates only — never legal advice, never a win %.
- No names, addresses or contact details in the form.
- Every pack must be approved by the market's lawyer team before going live.
