<div align="center">

# › codedrop

**Send redemption codes from your own SMTP, one click at a time.**

Map each recipient to a one-time code, write one template with a `{{code}}` token, and send the whole batch from your own mailbox. No build, no SaaS, self-hostable — a static page plus an optional 100-line backend.

[![Live demo](https://img.shields.io/badge/demo-live-1c7a4d.svg)](https://kpaxian7.github.io/codedrop/)
[![CI](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml/badge.svg)](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)

**🔗 [Live demo](https://kpaxian7.github.io/codedrop/)** — runs in demo mode (nothing is actually emailed).

English · [中文](README.zh-CN.md)

</div>

---

## What it does

- **Template + token.** Write the email once; `{{code}}` is replaced per recipient, with a live preview as you type.
- **Recipient table.** Paste or type emails and codes; each row shows its status (ready / no code / invalid / empty / sent), and can be sent on its own. Base64 addresses are auto-decoded, and bulk import is built in.
- **Bring-your-own SMTP.** Presets for Gmail, Outlook, Fastmail, iCloud, QQ and 163, each with app-password guidance.
- **Bilingual + local persistence.** Switch language in one click; template, recipients and SMTP settings are saved in the browser so a refresh never loses work.

## How to use

```bash
cd examples/server && npm install && npm start

...

CodeDrop is running — open http://localhost:8787
```

## Security

- **Self-hosted on purpose.** Run the backend on your own server — your SMTP credentials live only in your deployment and are never sent to any third party.
- **Use an app password, not your login password**, and keep it secret. The SMTP password is not saved to the browser by default; you re-enter it each session.
- **In production**, serve the backend over HTTPS and set `CORS_ORIGIN` to your front-end origin so credentials are never sent in the clear or accepted from arbitrary sites.

## License

[MIT](LICENSE)

<sub>UI originally designed with Claude.</sub>
