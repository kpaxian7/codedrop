<div align="center">

# › codedrop

**Send redemption codes from your own SMTP, one click at a time.**

Map each recipient to a one-time code, write one template with a `{{code}}` token, and send the whole batch from your own mailbox. No build, no SaaS, self-hostable — a static page plus an optional 100-line backend.

[![Live demo](https://img.shields.io/badge/demo-live-1c7a4d.svg)](https://kpaxian7.github.io/codedrop/)
[![CI](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml/badge.svg)](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)

**🔗 [Live demo](https://kpaxian7.github.io/codedrop/)** — runs in demo mode (nothing is actually emailed).

[中文](README.md) · English

</div>

---

## What it does

- **Template + token.** Write the email once; `{{code}}` is replaced per recipient, with a live preview as you type.
- **Recipient table.** Paste or type emails and codes; each row shows its status (ready / no code / invalid / empty / sent). Base64 addresses are auto-decoded, and bulk import is built in.
- **Bring-your-own SMTP.** Presets for Gmail, Outlook, Fastmail, iCloud, QQ and 163, each with app-password guidance.
- **Bilingual + local persistence.** Switch language in one click; template, recipients and SMTP settings are saved in the browser so a refresh never loses work.

## Deploy

It's a static site, so there are two ways to run it:

**① Demo only (nothing is emailed)** — host it as a static site:

```bash
git clone https://github.com/kpaxian7/codedrop.git
cd codedrop && python3 -m http.server 5173   # or any static host
```

Open `http://localhost:5173` to try it.

**② Real sending** — browsers can't speak SMTP, so run the bundled backend (it also serves the UI — **one command, no config edit**):

```bash
cd examples/server && npm install && npm start   # open the URL it prints
```

The front-end detects the backend and **switches to real sending automatically**; a static host with no backend stays safely in demo mode. To host front-end and backend separately, set `api.endpoint` explicitly in `assets/js/config.js` to override auto-detection.

## Configuration

Edit `assets/js/config.js` (branding, accent, SMTP presets, `api.endpoint`); all copy and the default email template live in `assets/js/i18n.js`. Edit and reload — no build.

## Security

Use **app-specific passwords** (not your login password); the SMTP password isn't persisted by default; in production serve the backend over HTTPS and set `CORS_ORIGIN`. Details in the [backend README](examples/server/README.md).

## License

[MIT](LICENSE)

<sub>UI originally designed with Claude.</sub>
