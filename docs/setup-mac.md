# Run Jeff 2 on your Mac

About 10 minutes the first time. After that: double-click one file.

## 1. Install two free tools (once)

- **Node.js** (runs the site): download the LTS version from https://nodejs.org and install it.
- **uv** (runs Jeff): open the Terminal app, paste this line, press Enter:
  ```
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

## 2. Download Jeff 2 (once)

On https://github.com/DynamicVision2026/Law-Firm-Jeff2 click **Code → Download ZIP**, then unzip it
(for example into your Documents folder). Or, in Terminal: `git clone https://github.com/DynamicVision2026/Law-Firm-Jeff2`

## 3. Get your Anthropic API key (once)

1. Go to https://console.anthropic.com → **API Keys** → **Create Key**.
2. Copy the key (starts with `sk-ant-`). Keep it private — don't paste it into chats or emails.

## 4. Fill in the settings file (once)

1. In the Law-Firm-Jeff2 folder, double-click **Start Jeff2.command**.
   - If macOS blocks it: right-click the file → **Open** → **Open**.
2. The first time, it creates a settings file and opens it in TextEdit. Fill in:
   ```
   ANTHROPIC_API_KEY=sk-ant-...your key...
   JEFF_DIR=/Users/yourname/jeff
   ```
   `JEFF_DIR` is the folder where you downloaded Jeff (the one with `pyproject.toml` in it).
   Tip: drag that folder into the TextEdit window to paste its exact path.
3. Save and close TextEdit.

## 5. Start

Double-click **Start Jeff2.command** again. It:
- starts Jeff (the first time it downloads the model, about 1.7 GB — wait a few minutes),
- starts the site,
- opens http://localhost:8000/web/ in your browser.

The Terminal window shows whether the AI and Jeff are on. Close the window to stop.

## Checking it works

- Write a problem in Japanese or Chinese and go through the questions.
- Anonymous results are saved in `data/log.jsonl`. Each line shows the AI's category and Jeff's category
  side by side (`category` vs `jeffCategory`), so we can measure how often Jeff agrees.

## If something goes wrong

- "TEST MODE" in the Terminal window → the key in `.env` is missing or mistyped.
- "Jeff failed to start" → check `JEFF_DIR` points at the Jeff folder; the site still works without Jeff.
- Port already in use → change `PORT=8001` in `.env`.

## Share with your team (internal test)

Your Mac runs everything; a free Cloudflare link lets team members in Japan and China open it in a browser.

1. Install the link tool once (Terminal): `brew install cloudflared`
   (no Homebrew? install it first from https://brew.sh)
2. In `.env`, set:
   ```
   SHARE=yes
   SITE_PASSWORD=choose-a-team-password
   ```
3. Double-click **Start Jeff2.command**. The window shows **TEAM LINK: https://….trycloudflare.com/web/**
   and copies it for you. Send the link and the password to the team **separately**.

Good to know:
- Works only while the window is open and the Mac is on (it keeps the Mac awake while sharing).
- The link changes each time you restart — send the new one.
- Everyone's tests are logged anonymously on your Mac in `data/log.jsonl`.
- Mainland China: Cloudflare links may be slow or blocked there. If the China team can't open it,
  they can test through a VPN for now; a mainland-hosted version comes later.
- Turn sharing off with `SHARE=no` when the test is over.
