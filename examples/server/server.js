/*
 * CodeDrop — optional reference backend
 * ============================================================================
 * The CodeDrop UI is a static front-end and ships in "demo mode" (nothing is
 * actually sent). Because browsers cannot speak SMTP, real sending needs a
 * tiny server. This is that server — ~100 lines, one dependency (nodemailer).
 *
 *   1. cd examples/server
 *   2. cp .env.example .env   # optional — see notes below
 *   3. npm install
 *   4. npm start              # listens on http://localhost:8787
 *
 * Then set, in assets/js/config.js:
 *   api: { endpoint: "http://localhost:8787/api/send" }
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
const nodemailer = require("nodemailer");

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
  const from = s.fromName ? `${s.fromName} <${s.fromEmail || s.user}>` : (s.fromEmail || s.user);
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
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`CodeDrop backend listening on http://localhost:${PORT}`);
  console.log(`  POST /api/send   — send a batch`);
  console.log(`  SMTP source: ${FROM_ENV ? ".env (SMTP_FROM_ENV=true)" : "request body (from the UI)"}`);
  if (ALLOW_ORIGIN === "*") {
    console.warn("  ⚠ CORS is open to ALL origins (CORS_ORIGIN unset). Fine for local dev;");
    console.warn("    set CORS_ORIGIN to your exact front-end origin before deploying.");
  } else {
    console.log(`  CORS origin: ${ALLOW_ORIGIN}`);
  }
});
