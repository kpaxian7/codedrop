# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Static front-end implementation of CodeDrop (vanilla HTML/CSS/JS, no build step).
- Email template editor with a `{{code}}` token and live preview.
- Recipient table with Base64 email auto-decoding and per-row status.
- Paste-import modal (codes-only and email+code modes) with live detection.
- SMTP settings drawer with provider quick-presets (Gmail, Outlook, Fastmail,
  iCloud, QQ, 163) and app-password guidance.
- English / 中文 internationalisation and emerald / blue / violet accents.
- localStorage persistence for the template, recipients and SMTP settings.
- Demo send mode by default; optional reference backend (`examples/server`,
  Node + nodemailer) for real SMTP sending.
- Keyboard accessibility: visible focus on all controls, dialog focus
  management and a focus trap, and ARIA labelling.

### Security
- SMTP password is not persisted to localStorage by default (`persistSmtpPassword: false`).
- Front-end refuses to send credentials to a non-HTTPS endpoint (localhost excepted).
- Reference backend validates the SMTP port and warns when CORS is left open to all origins.

[Unreleased]: https://github.com/kpaxian7/codedrop/commits/main
