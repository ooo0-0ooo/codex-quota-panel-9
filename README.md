# Codex Quota Panel

English · [简体中文](./README.zh-CN.md)

A Codex quota dashboard for Windows. It displays your official Codex weekly usage limit, available reset credits, tokens used today, and lifetime token usage.

> This is not an official OpenAI product. It reads account data through the official OpenAI Codex app-server already signed in on your computer, and uses local Codex session logs when the official current-day usage bucket is not yet available. It does not depend on third-party quota extensions or upload any data.

## Overview

- Borderless, soft neumorphic interface matching the design
- Three equally sized window controls for language switching, minimizing, and closing; closing keeps the app in the system tray, while minimizing sends it to the taskbar
- Chinese and English UI; on first launch, the app follows the Windows system language
- Fixed panel height; when more than three reset credits are available, a dedicated scrollbar appears and the mouse wheel scrolls the reset list while the pointer is over the panel
- Only the **Use reset** button can initiate a reset; after confirmation, the app calls the official Codex reset endpoint
- System tray menu for showing the panel, keeping it always on top, starting with Windows, and quitting
- Refreshes at launch and every 60 seconds; press `F5` or use the panel context menu to refresh manually

<img width="875" height="759" alt="Codex Quota Panel" src="https://github.com/user-attachments/assets/ed2ed2d1-a4f4-42b8-b993-e16f0215eb57" />

## Data sources, collection, and refresh cadence

| Data / action | Source | Collection and validation | Refresh cadence |
| --- | --- | --- | --- |
| Weekly usage limit and remaining percentage | Official OpenAI Codex app-server: `account/rateLimits/read` | Selects the longest rate-limit window and uses the official `usedPercent` value directly. | At launch, every 60 seconds, on `F5` / manual refresh, and after a successful reset |
| Weekly reset date and time | Same as above | Reads the official `resetsAt` Unix timestamp and displays it in your Windows time zone as `M/D HH:mm`; the time is not estimated. | Same as above |
| Reset credit cards | `rateLimitResetCredits` returned by the same endpoint | Reads each credit's `id`, `title`, `status`, and `expiresAt`. The panel shows exactly the credits returned and never pads the list with the weekly limit window. | Same as above |
| Use a reset credit | Official OpenAI Codex app-server: `account/rateLimitResetCredit/consume` | Submits the selected card's `creditId` only after its button is clicked and the confirmation dialog is accepted. Each request includes a new `idempotencyKey` to prevent duplicate consumption, and handles the official `reset`, `nothingToReset`, `noCredit`, and `alreadyRedeemed` results. | Once per confirmation; all data refreshes immediately after success |
| Tokens used today | Prefers the current-day `dailyUsageBuckets` value from official `account/usage/read`; otherwise uses `%USERPROFILE%\.codex\sessions\**\*.jsonl` | Uses the official account-level value when a current-day bucket exists. Otherwise scans every session directory for `event_msg/token_count` events whose timestamps fall within the current local day. It counts positive changes in `total_token_usage`; for the first event or a counter reset, it falls back to `last_token_usage`; unchanged snapshots count as zero. Scanning all date directories includes sessions that continue after midnight while still writing to their original creation-date file. | At launch, every 60 seconds, and on `F5` / manual refresh |
| Lifetime tokens | Official OpenAI Codex app-server: `account/usage/read` | Uses the account-level `summary.lifetimeTokens` value directly. | Same as above |
| Official daily-usage fallback | `dailyUsageBuckets` returned by the same endpoint | If neither an official current-day bucket nor verifiable local events are available, shows the latest official daily bucket. If it belongs to the previous day, the UI labels it as **Yesterday's usage**. | Same as above |

### Accuracy limits for today's token usage

Once the official current-day `dailyUsageBuckets` value is available, the app uses it as the authoritative account-level figure. Until then, local logs accurately cover retained Codex activity on this computer, but cannot include activity from other devices, deleted logs, cloud tasks that were never written locally, or reliably separate different users who signed in on the same computer.

The real-time aggregation approach was inspired by the MIT-licensed [1nuYasha-cck/codex-quota-widget](https://github.com/1nuYasha-cck/codex-quota-widget/blob/main/src/main/quota-service.js), with two corrections for cases that can produce different totals:

1. The reference implementation checks only the UTC date directories adjacent to the current local date. A session resumed after midnight may continue writing to an older creation-date directory and be missed.
2. The reference implementation sums every `last_token_usage` value. This project instead uses changes between cumulative snapshots and ignores unchanged duplicates to avoid double counting.

For verification, today's usage response also includes read-only diagnostics: sessions scanned, raw events, counted events, duplicate snapshots, and token totals grouped by session creation date.

## Privacy and authentication

- The app never reads or prints Codex authentication tokens.
- Authentication, token refresh, and official API requests are handled by the local Codex app-server.
- Local logs are read and aggregated only on your computer and are never uploaded to this project or a third party.

## Run locally

Requires Node.js 22 or later and a signed-in OpenAI Codex installation.

```bash
npm install
npm start
```

## Test and build

```bash
npm test
npm run capture
npm run build
```

The Windows installer and portable executable are generated in `dist/`.

References: [OpenAI Codex app-server protocol](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md), [Microsoft Windows typography guidance](https://learn.microsoft.com/windows/apps/design/signature-experiences/typography).

## License

[MIT](./LICENSE)
