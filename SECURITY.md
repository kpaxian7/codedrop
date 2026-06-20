# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

Use GitHub's private advisory form:
<https://github.com/kpaxian7/codedrop/security/advisories/new>

We'll acknowledge your report as soon as we can and keep you updated on the fix.

## Security model

CodeDrop is **self-hosted**. The front-end is a static page and, by design,
holds and transmits your SMTP credentials only within your own deployment:

- **Passwords are not persisted by default.** `persistSmtpPassword` is `false`,
  so the SMTP password is kept only in memory for the session.
- **Credentials never go over plain HTTP.** When a real send endpoint is
  configured, the front-end refuses to transmit credentials unless the endpoint
  is HTTPS (localhost is allowed for development).
- **The optional backend** (`examples/server`) accepts SMTP settings from the
  request or from its own `.env` (`SMTP_FROM_ENV=true`). In production, always
  serve it over HTTPS and set `CORS_ORIGIN` to your exact front-end origin.

## Hardening checklist for deployments

- [ ] Serve both the site and the backend over HTTPS.
- [ ] Set `CORS_ORIGIN` to your front-end origin (never `*`).
- [ ] Use an app-specific password / authorization code, not your login password.
- [ ] Keep `persistSmtpPassword: false` on shared machines.
- [ ] Restrict who can reach the backend (network rules / auth header).
