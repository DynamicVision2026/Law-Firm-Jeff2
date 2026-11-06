# Case-Pack Guide (for the lawyer teams)

A **case pack** is everything the engine knows about one case type in one
market. Lawyers write and approve it. No coding is needed — the engine reads
the file as it is.

File location: `case-packs/<market>/<case-type>.json`
(e.g. `case-packs/jp/traffic.json`). Use the Japan traffic pack as the
model; copy it and replace the content.

## The 7 parts of a pack

| Part | What the lawyers write | Used by |
|---|---|---|
| `meta` | Market, case type, language, approving lawyer, review date | Display, audit |
| `questions` | 8–10 key questions with fixed answer options, plus 1 short free-text box | Form |
| `jeff` | The fixed options Jeff chooses between (recommendation level, urgency, key factors) | Jeff |
| `calculator` | Estimate table (e.g. court-standard amounts by treatment length) | Calculator |
| `factors` | One plain sentence per key factor, explaining why it matters | Result screen |
| `warnings` | Red-flag rules and their warning text (deadlines, signed settlements) | Result screen |
| `result` | Headline wording per recommendation level, next-step text, disclaimer | Result screen |

## Writing rules

1. **Ask only what decides value or urgency.** If an answer would not change
   the result, remove the question.
2. **No personal data.** Region not address, time ranges not exact dates,
   no names or contact details.
3. **Information, not advice.** Write "cases like this often…", never
   "you will win" or "you have no case". No win percentages.
4. **Estimates are ranges** and must say which standard they are based on.
5. **Plain language.** A person in distress should understand it in one read.
6. **Every factor sentence ≤ 60 characters (JP/CN) or ≤ 20 words (EN).**

## Review checklist (before a pack goes live)

- [ ] Questions are complete and in the right order
- [ ] Estimate table matches the current standard (cite the edition)
- [ ] Deadlines are correct for this market
- [ ] No sentence promises a result or gives case-specific advice
- [ ] Advertising / professional-conduct rules for this market are met
- [ ] Approving lawyer and date are filled in `meta`

## Status values (`meta.status`)

- `draft` — written, not yet reviewed (cannot go live)
- `reviewed` — checked by a lawyer, changes pending
- `approved` — signed off, can go live
