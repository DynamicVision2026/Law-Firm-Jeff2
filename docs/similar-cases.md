# "How similar cases ended" — court statistics in the report

The report can show, next to Jeff's judgment, how similar cases actually ended in court:
how often the person suing got all or part of the claim, the typical amount, and how one fact
(for example written evidence) changed the result. The numbers come from published judgments.

It only appears for a market and case type once we have at least 20 decisions.
Wording on screen: "how similar court cases ended" — never "your chance of winning". Settled cases are not included.

## Markets

| Market | Source | Status |
|---|---|---|
| Taiwan | Judicial Yuan open data (free) | Ready: steps below |
| Hong Kong | HKLII public judgments | Check HKLII's terms for automated use first; then save judgments as .txt files and run step 2 |
| Japan | Judgment database (判例秘書 / D1-Law / Westlaw Japan / TKC) | Needs a data license for product use |
| Mainland China | 北大法宝 / 威科先行 | Needs a data license for product use |
| Singapore | Published judgments / LawNet | Needs a license; Singapore is not a market in the tool yet |

Never scrape court websites against their terms.

## Taiwan, step by step (on your Mac, in the Law-Firm-Jeff2 folder)

**1. Get judgments** — either way works:

- **Monthly package:** on the 司法院資料開放平臺 (opendata.judicial.gov.tw) download a monthly judgment package,
  unzip it (double-click; for .rar files use The Unarchiver), and note the folder.
- **Official API:** register a free account on the 司法院資料開放平臺, add to `.env`:
  ```
  TW_JUDICIAL_USER=your-account
  TW_JUDICIAL_PASSWORD=your-password
  ```
  then run between 00:00 and 06:00 Taiwan time (01:00–07:00 Japan time):
  ```
  node tools/outcomes/fetch-tw.mjs
  ```
  Each night gives about one day of judgments; run it a few nights. Files go to `data/tw-judgments/`.

**2. Read them with the AI** (about $2–5 per 1,000 judgments). First check what it will pick, without cost:
```
node tools/outcomes/extract.mjs --market tw --in data/tw-judgments --dry
```
then for real (up to 300 per case type; it can be stopped and re-run, it continues where it stopped):
```
node tools/outcomes/extract.mjs --market tw --in data/tw-judgments --max 300
```
Only the extracted facts and judgment ID are saved (`data/outcomes/tw-facts.jsonl`), never the text or names.

**3. Build the table:**
```
node tools/outcomes/build.mjs --market tw
```
This writes `engine/outcomes/tw.json`. Restart Jeff 2 and the Taiwan reports show the court section.

## Checking quality

Before showing the numbers publicly, a Taiwanese lawyer should read 20 random lines of `tw-facts.jsonl`
next to the judgments (search the ID on judgment.judicial.gov.tw) and confirm the AI read the outcome and amounts correctly.
