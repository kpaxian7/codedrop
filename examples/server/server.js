/*
 * CodeDrop — optional reference backend
 * ============================================================================
 * The CodeDrop UI is a static front-end and ships in "demo mode" (nothing is
 * actually sent). Because browsers cannot speak SMTP, real sending needs a
 * tiny server. This is that server — one dependency (nodemailer). It serves
 * BOTH the UI and the send API, so self-hosting is a single process:
 *
 *   1. cd examples/server
 *   2. cp .env.example .env   # optional — see notes below
 *   3. npm install
 *   4. npm start              # open http://localhost:8787
 *
 * No config edit is needed: the front-end probes GET /health and, finding this
 * backend, switches itself from demo mode to real sending automatically. (You
 * can still hard-set api.endpoint in assets/js/config.js to override.)
 *
 * SMTP credentials:
 *   - By default the SMTP settings entered in the UI are used (they are sent
 *     in the request body). This matches the design: "credentials never leave
 *     your deployment" — your deployment being this server, which you run.
 *   - For a more locked-down setup, put SMTP settings in .env and set
 *     SMTP_FROM_ENV=true; the server then ignores client-supplied credentials.
 *
 * This file uses only Node's built-in `http` plus `nodemailer`. No framework.
 * ============================================================================
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// The repo root (two levels up from examples/server) — served as the static UI so
// a self-hoster runs ONE process: this server provides both the page and /api/send.
const STATIC_ROOT = path.resolve(__dirname, "..", "..");
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2", ".map": "application/json; charset=utf-8",
};

// Load .env if present (no dependency required).
try { require("fs").readFileSync(require("path").join(__dirname, ".env"), "utf8")
  .split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch (e) { /* no .env, that's fine */ }

const PORT = parseInt(process.env.PORT || "8787", 10);
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*"; // tighten this in production
const FROM_ENV = String(process.env.SMTP_FROM_ENV || "").toLowerCase() === "true";

function buildTransport(clientSmtp) {
  const s = FROM_ENV
    ? {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        security: process.env.SMTP_SECURITY || "SSL/TLS",
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        fromName: process.env.SMTP_FROM_NAME || "",
        fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      }
    : clientSmtp || {};

  if (!s.host || !s.user || !s.pass) {
    throw new Error("SMTP host, user and pass are required");
  }
  const port = parseInt(s.port, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP port must be a number between 1 and 65535");
  }
  const transport = nodemailer.createTransport({
    host: s.host,
    port: port,
    // "SSL/TLS" => implicit TLS (usually 465). "STARTTLS" => upgrade (usually 587).
    secure: s.security === "STARTTLS" ? false : port === 465,
    requireTLS: s.security === "STARTTLS",
    auth: { user: s.user, pass: s.pass },
  });
  // The From address is the authenticated account. From the UI that's the login
  // (s.user — labelled "from email"); s.fromEmail there is the test recipient, not
  // a sender. The .env path keeps its explicit SMTP_FROM_EMAIL.
  const fromAddr = FROM_ENV ? (s.fromEmail || s.user) : s.user;
  const from = s.fromName ? `${s.fromName} <${fromAddr}>` : fromAddr;
  return { transport, from };
}

async function handleSend(body, res) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let built;
  try { built = buildTransport(body.smtp); }
  catch (e) { return json(res, 400, { error: e.message }); }

  const results = [];
  for (const m of messages) {
    try {
      await built.transport.sendMail({
        from: built.from,
        to: m.to,
        subject: m.subject,
        text: m.body, // plain-text email (the template is plain text)
      });
      results.push({ id: m.id, ok: true });
    } catch (err) {
      results.push({ id: m.id, ok: false, error: String(err && err.message || err) });
    }
  }
  json(res, 200, { results });
}

// Serve a file from STATIC_ROOT. Guards against path traversal; 404s on a miss
// so the caller can fall through. "/" maps to index.html.
function serveStatic(urlPath, req, res) {
  try { urlPath = decodeURIComponent(urlPath); } catch (e) {}
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  const filePath = path.resolve(STATIC_ROOT, "." + urlPath);
  if (filePath !== STATIC_ROOT && !filePath.startsWith(STATIC_ROOT + path.sep)) {
    return json(res, 403, { error: "forbidden" });
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { error: "not found" });
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

function json(res, status, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "POST" && req.url === "/api/send") {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 5e6) req.destroy(); // 5 MB guard
    });
    req.on("end", () => {
      let body;
      try { body = JSON.parse(raw || "{}"); }
      catch (e) { return json(res, 400, { error: "invalid JSON" }); }
      handleSend(body, res).catch((e) => json(res, 500, { error: String(e.message || e) }));
    });
    return;
  }
  const urlPath = req.url.split("?")[0];
  // GET /health is the marker the front-end probes to auto-enable real sending.
  if (req.method === "GET" && urlPath === "/health") return json(res, 200, { ok: true });
  // Everything else: serve the static UI (index.html + assets/) from the repo root.
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(urlPath, req, res);
  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`CodeDrop is running — open http://localhost:${PORT}`);
  console.log(`  GET  /            — the CodeDrop UI (served from ${STATIC_ROOT})`);
  console.log(`  POST /api/send    — send a batch`);
  console.log(`  GET  /health      — backend probe (front-end auto-enables real sending)`);
  console.log(`  SMTP source: ${FROM_ENV ? ".env (SMTP_FROM_ENV=true)" : "request body (from the UI)"}`);
  if (ALLOW_ORIGIN === "*") {
    console.warn("  ⚠ CORS is open to ALL origins (CORS_ORIGIN unset). Fine for local dev;");
    console.warn("    set CORS_ORIGIN to your exact front-end origin before deploying.");
  } else {
    console.log(`  CORS origin: ${ALLOW_ORIGIN}`);
  }
});
