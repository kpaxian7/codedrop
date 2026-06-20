<div align="center">

# › codedrop

**Send redemption codes from your own SMTP, one click at a time.**

Map each recipient to a one-time code, write one template with a `{{code}}`
token, and send the whole batch from your own mailbox. No build step, no SaaS,
no vendor lock-in — it's a static page plus an optional 100-line backend.

[![CI](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml/badge.svg)](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)
![No build step](https://img.shields.io/badge/build-none-brightgreen.svg)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-1c7a4d.svg)](CONTRIBUTING.md)

[Quick start](#quick-start) · [Configuration](#configuration) · [Deploy](#deploy) · [Real sending](#turning-on-real-sending) · [Security](#security-notes)

</div>

---

## What it does

CodeDrop is a small self-hosted tool for the very common "I have a pile of
redemption / license / invite codes and a list of people to send them to" job.

- **Template + token.** Write the email once; `{{code}}` is replaced per
  recipient. Live preview as you type.
- **Recipient table.** Paste or type emails and codes. Each row shows its
  status (`ready` / `no code` / `invalid` / `empty` / `sent`).
- **Base64-aware.** Email fields accept plain addresses *or* Base64 — encoded
  addresses are decoded automatically.
- **Bulk import.** Paste a blob of codes, or `email, code` pairs (comma / tab /
  space separated), and it splits into rows.
- **Bring-your-own SMTP.** Quick presets for Gmail, Outlook, Fastmail, iCloud,
  QQ and 163, with app-password guidance for each.
- **Bilingual.** English and 中文 out of the box; add more in one file.
- **Persists locally.** Your template, recipients and SMTP settings are saved
  to `localStorage` so a refresh never loses work.

> **Demo mode by default.** Out of the box nothing is actually emailed — the
> Send button runs a realistic simulation so you can try everything safely.
> Flip on [real sending](#turning-on-real-sending) when you're ready.

## Quick start

It's a static site. Clone it and serve the folder — pick any option:

```bash
git clone https://github.com/kpaxian7/codedrop.git
cd codedrop

# Option A — npm script (Python under the hood)
npm run dev          # http://localhost:5173

# Option B — Python directly
python3 -m http.server 5173

# Option C — Node
npx serve .

# Option D — just open index.html in a browser
```

Then visit `http://localhost:5173`. That's it — you're in demo mode (nothing is
actually emailed). See [Turning on real sending](#turning-on-real-sending) when ready.

## Project layout

```
codedrop/
├── index.html              # the page; loads the scripts below in order
├── assets/
│   ├── css/styles.css      # all styles (design tokens at the top)
│   ├── favicon.svg
│   └── js/
│       ├── config.js       # ← edit me: branding, accent, providers, endpoint
│       ├── i18n.js         # ← edit me: all UI copy + default email template
│       ├── send.js         # demo/real send abstraction (backend contract)
│       └── app.js          # state + render + behaviour (no dependencies)
├── examples/
│   └── server/             # optional reference backend (Node + nodemailer)
└── design/                 # the original Claude design export (reference)
```

## Configuration

Almost everything you'd customise lives in **`assets/js/config.js`** — edit and
reload, no rebuild. Highlights:

| Key | What it does |
| --- | --- |
| `appName`, `version` | Branding shown next to the logo. |
| `defaultLang` | `"en"` or `"zh"` — initial language. |
| `accent` | `"emerald"`, `"blue"` or `"violet"`. |
| `showPreview` | Show the live email preview pane. |
| `detectBase64` | Auto-decode Base64 email addresses. |
| `github` | The "Star" button (`url`, `stars`, `show`). |
| `persist` / `persistSmtpPassword` | localStorage behaviour. |
| `api.endpoint` | `null` = demo mode; a URL = real sending. |
| `providers` | The SMTP quick-setup presets (add your own). |
| `seedRows` | Example rows shown on first load. |

The **default email wording** (subject + body) and **every visible string**
live in **`assets/js/i18n.js`** under `tplSubject` / `tplBody`. Edit those to
make the campaign yours. To add a language, copy the `en` block, translate it,
and add a matching button in `topbar()` (`assets/js/app.js`).

## Deploy

Because it's static, deployment is "upload these files":

- **GitHub Pages** — push the repo, enable Pages on the default branch (root).
- **Netlify / Cloudflare Pages / Vercel** — new project, no build command,
  publish directory `.` (the repo root).
- **Any web server** — copy the folder into your web root (nginx/Apache/Caddy).

No environment variables are needed for the static site itself. They only come
into play if you run the [backend](#turning-on-real-sending).

## Turning on real sending

Browsers can't open SMTP connections, so real sending needs a small backend.
A ready-to-run one lives in [`examples/server/`](examples/server/):

```bash
cd examples/server
npm install
npm start                      # http://localhost:8787
```

Then in `assets/js/config.js`:

```js
api: { endpoint: "http://localhost:8787/api/send" }
```

Reload — the Send button now sends for real. The backend can take SMTP
credentials from the UI (default) or from its own `.env` (`SMTP_FROM_ENV=true`)
for shared deployments. Full contract and deploy notes are in the
[backend README](examples/server/README.md). Any server that implements the
same `POST /api/send` contract works — wire CodeDrop to your own if you prefer.

## Security notes

CodeDrop is **self-hosted on purpose** — credentials stay within your own
deployment. A few things to keep in mind:

- **App passwords, not your login password.** Gmail / Outlook / iCloud /
  Fastmail / QQ / 163 all reject your normal password over SMTP. Generate an
  app-specific password (some call it an "authorization code") — the SMTP drawer
  links the exact path for each provider.
- **The SMTP password is not persisted by default** — you re-enter it each
  session (everything else, including host/user, is saved to `localStorage`).
  On a trusted single-user machine you can set `persistSmtpPassword: true` in
  `config.js` for convenience.
- **Serve the backend over HTTPS** and set `CORS_ORIGIN` to your exact
  front-end origin (never `*`) in production, so credentials are never sent in
  the clear or accepted from arbitrary sites.
- **Respect anti-spam law.** Only message people who opted in, include a way to
  unsubscribe/reply, and mind your provider's sending limits.

## Tech

Plain HTML, CSS and JavaScript — **no framework, no build step, no
dependencies** for the front-end. The whole UI is a pure function of state with
focus/IME-safe re-rendering (see `assets/js/app.js`). The only dependency
anywhere is `nodemailer`, in the optional backend.

## Contributing

Issues and PRs welcome! Please read:

- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, project map, how to add a language
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — be kind
- [SECURITY.md](SECURITY.md) — report vulnerabilities privately
- [CHANGELOG.md](CHANGELOG.md) — notable changes

Run `npm run check` before opening a PR (it verifies every script parses).

## License

[MIT](LICENSE) — do what you like, just keep the notice.

<sub>UI originally designed with Claude; see <code>design/</code> for the original export.</sub>
