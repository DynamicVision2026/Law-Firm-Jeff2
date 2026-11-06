# Jeff 2 — Free Legal Case Check (MVP, Stage 1)

A free, lawyer-supervised case check for individuals. People answer a short
form (no personal data), and get an instant result: how strongly a lawyer
consultation is recommended, an estimated range, key points, deadlines and a
next step.

**Stage 1 goal:** prove that people use the check, find it helpful, and that
the screening agrees with lawyers' judgment. Law-firm delivery comes in Stage 2.

## How it works

```
Form answers + short free text
        │
  ┌─────┼──────────────┐
  ▼     ▼              ▼
Jeff   Calculator     Templates
(judge) (money range)  (lawyer-written reasons, warnings, next step)
  └─────┴──────────────┘
        ▼
  Result screen  →  anonymized case log  →  lawyer review
```

- **Jeff** (open-source small decision model) picks between fixed options:
  recommendation level, urgency, key factors.
- **Calculator** applies the lawyers' estimate table.
- **Templates** are sentences written and approved by the local lawyer team.

## Repository layout

```
case-packs/        Lawyer content, one file per market + case type (no coding)
  jp/ tw/ hk/ cn/
docs/              Case-pack guide for the lawyer teams
engine/            Screening + calculator + templates (next step)
web/               Free check page and result screen (next step)
```

## Markets and case types (MVP)

| Market | Language | Case types |
|---|---|---|
| Japan (jp) | Japanese | traffic, divorce, labor |
| Taiwan (tw) | Traditional Chinese | traffic, divorce, labor |
| Hong Kong (hk) | Traditional Chinese + English | traffic, divorce, labor |
| Mainland China (cn) | Simplified Chinese | traffic, divorce, labor |

## Status

- [x] Case-pack format + guide for lawyers
- [x] Traffic-accident packs: Japan (ja), Taiwan (zh-Hant), mainland China (zh-Hans) — **all DRAFT, need lawyer review**
- [x] Engine: judge (lawyer rules now, Jeff when `JEFF_URL` is set) + calculator + templates
- [x] Web form and result screen with language switch (日本語 / 繁體中文 / 简体中文)
- [x] Anonymized log record with consent (console now, `LOG_URL` later)
- [ ] Jeff service (local model) and accuracy comparison vs. lawyer rules
- [ ] Amount tables for Taiwan and mainland (local lawyers)
- [ ] Divorce and labor packs; Hong Kong pack

## Run it locally

```
python3 -m http.server 8000      # from the repo root
open http://localhost:8000/web/          # Japanese
open http://localhost:8000/web/?m=tw     # Taiwan
open http://localhost:8000/web/?m=cn     # mainland China
node tests/engine.test.mjs       # engine tests
```

## Ground rules (all markets)

- General information and estimates only — never legal advice, never a win %.
- No names, addresses or contact details in the form.
- Every pack must be approved by the market's lawyer team before going live.
