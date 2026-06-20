/*
 * CodeDrop — send abstraction
 * ============================================================================
 * Browsers can't open SMTP connections, so this module has two modes:
 *
 *   DEMO MODE  (config.api.endpoint is null/empty)
 *     Nothing is sent. Each message resolves "ok" after a short staggered
 *     delay so the table animation and counters behave exactly like the
 *     real thing — perfect for trying the UI or recording a demo.
 *
 *   REAL MODE  (config.api.endpoint is a URL)
 *     POSTs the whole batch to your backend and reports results per recipient.
 *
 * Backend contract (see examples/server/ for a working implementation):
 *
 *   POST <endpoint>
 *   Content-Type: application/json
 *   {
 *     "smtp": { host, port, security, user, pass, fromName, fromEmail },
 *     "messages": [ { "id": <any>, "to": "a@b.com", "subject": "...", "body": "..." } ]
 *   }
 *
 *   200 OK
 *   { "results": [ { "id": <same id>, "ok": true } |
 *                  { "id": <same id>, "ok": false, "error": "reason" } ] }
 * ============================================================================
 */
(function () {
  "use strict";

  var DEMO_STAGGER_MS = 260; // matches the original design's send animation

  function cfg() {
    return (window.CODEDROP_CONFIG && window.CODEDROP_CONFIG.api) || {};
  }

  function isReal() {
    var e = cfg().endpoint;
    return typeof e === "string" && e.trim().length > 0;
  }

  // HTTPS anywhere, or HTTP only for localhost/loopback (development). Also allow
  // same-origin relative endpoints like "/api/send" (inherit the page's scheme).
  function isLocalOrHttps(url) {
    if (/^\//.test(url)) return true; // relative → same origin as the page
    if (/^https:\/\//i.test(url)) return true;
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(url);
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /**
   * Send a batch of messages.
   * @param {Array<{id:any,to:string,subject:string,body:string}>} messages
   * @param {object} smtp
   * @param {object} handlers { onResult(result), onDone(summary) }
   *   result  = { id, ok, error? }
   *   summary = { sent, failed, total, demo }
   */
  async function sendBatch(messages, smtp, handlers) {
    handlers = handlers || {};
    var onResult = handlers.onResult || function () {};
    var onDone = handlers.onDone || function () {};

    if (!messages.length) {
      onDone({ sent: 0, failed: 0, total: 0, demo: !isReal() });
      return;
    }

    if (!isReal()) {
      // DEMO MODE — stagger "ok" results to mimic a live send.
      var sent = 0;
      for (var i = 0; i < messages.length; i++) {
        await delay(DEMO_STAGGER_MS);
        onResult({ id: messages[i].id, ok: true });
        sent++;
      }
      onDone({ sent: sent, failed: 0, total: messages.length, demo: true });
      return;
    }

    // REAL MODE — POST the batch, then surface results (staggered for nicer UX).
    var endpoint = cfg().endpoint;
    var extraHeaders = cfg().headers || {};

    // Credentials travel in the request body — refuse to do that over plain HTTP
    // (localhost excepted for development). Keeps passwords off the wire.
    if (!isLocalOrHttps(endpoint)) {
      var msg = "Refusing to send SMTP credentials to a non-HTTPS endpoint (" + endpoint + "). Use HTTPS in production — see README › Security.";
      console.error("[CodeDrop] " + msg);
      failAll(messages, msg, onResult);
      onDone({ sent: 0, failed: messages.length, total: messages.length, demo: false });
      return;
    }

    var resp;
    try {
      resp = await fetch(endpoint, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders),
        body: JSON.stringify({ smtp: smtp, messages: messages }),
      });
    } catch (err) {
      // Network/CORS failure — fail every message with the same reason.
      failAll(messages, "network error: " + (err && err.message || err), onResult);
      onDone({ sent: 0, failed: messages.length, total: messages.length, demo: false });
      return;
    }

    if (!resp.ok) {
      var text = "";
      try { text = (await resp.text()).slice(0, 200); } catch (e) {}
      failAll(messages, "HTTP " + resp.status + (text ? " — " + text : ""), onResult);
      onDone({ sent: 0, failed: messages.length, total: messages.length, demo: false });
      return;
    }

    var data;
    try { data = await resp.json(); } catch (e) { data = null; }
    var results = (data && data.results) || [];
    var byId = {};
    results.forEach(function (r) { byId[String(r.id)] = r; });

    var ok = 0, bad = 0;
    for (var j = 0; j < messages.length; j++) {
      var m = messages[j];
      var r = byId[String(m.id)];
      if (!r) { r = { id: m.id, ok: false, error: "no result returned" }; console.warn("[CodeDrop] backend returned no result for message id " + m.id); }
      await delay(120); // light stagger so rows flip in sequence
      onResult({ id: m.id, ok: !!r.ok, error: r.error });
      if (r.ok) ok++; else bad++;
    }
    onDone({ sent: ok, failed: bad, total: messages.length, demo: false });
  }

  function failAll(messages, reason, onResult) {
    messages.forEach(function (m) { onResult({ id: m.id, ok: false, error: reason }); });
  }

  /**
   * Send a single test message (used by the drawer's "Send test" button).
   * @returns {Promise<{ok:boolean, demo:boolean, error?:string, to:string}>}
   */
  async function sendTest(message, smtp) {
    if (!isReal()) {
      await delay(400);
      return { ok: true, demo: true, to: message.to };
    }
    var result = { ok: false, demo: false, to: message.to };
    await sendBatch([message], smtp, {
      onResult: function (r) { result.ok = r.ok; result.error = r.error; },
    });
    return result;
  }

  window.CodeDropSender = { sendBatch: sendBatch, sendTest: sendTest, isReal: isReal };
})();
