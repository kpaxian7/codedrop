# CodeDrop reference backend

A small Node server that turns CodeDrop from a demo into a real sender. One
dependency (`nodemailer`), no framework. It serves **both** the CodeDrop UI and
the send API, so self-hosting is a single process.

## Run

```bash
cd examples/server
npm install
npm start            # open http://localhost:8787
```

Open the URL it prints and send for real — **no config edit needed**. The
front-end probes `GET /health`, finds this backend, and switches itself from
demo mode to real sending on `/api/send` automatically.

> Hosting the front-end separately instead (e.g. GitHub Pages + this backend on
> another origin)? Then set the endpoint explicitly in `assets/js/config.js`:
> `api: { endpoint: "https://your-backend.example.com/api/send" }` — an explicit
> value overrides auto-detection. Remember to set `CORS_ORIGIN` (see Deploying).

## Where SMTP credentials come from

- **From the UI (default).** The SMTP settings you type into the drawer are sent
  in the request body and used per request. Nothing is stored server-side.
- **From `.env` (locked down).** Copy `.env.example` to `.env`, fill in the
  `SMTP_*` values, and set `SMTP_FROM_ENV=true`. The server then ignores any
  credentials from the browser. Good for shared/team deployments.

## API contract

```
POST /api/send
Content-Type: application/json

{
  "smtp": { "host": "...", "port": "465", "security": "SSL/TLS",
            "user": "...", "pass": "...", "fromName": "...", "fromEmail": "..." },
  "messages": [ { "id": 1, "to": "a@b.com", "subject": "...", "body": "..." } ]
}

→ 200 OK
{ "results": [ { "id": 1, "ok": true },
               { "id": 2, "ok": false, "error": "reason" } ] }
```

`GET /health` returns `{ "ok": true }`.

## Deploying

This is a standard Node HTTP server, so it runs anywhere Node runs (a VPS,
Railway, Render, Fly.io, a container, etc.). Two things to set in production:

- `CORS_ORIGIN` — the exact origin your front-end is served from (not `*`).
- TLS — terminate HTTPS in front of it (reverse proxy / platform default) so
  SMTP credentials are never sent in clear text.

> Serverless note: the same contract works on Vercel/Netlify/Cloudflare
> functions — copy `handleSend()` into a function handler and use the platform's
> SMTP-capable runtime (or an email API). Plain SMTP needs a Node-style runtime.
