/*
 * CodeDrop — application
 * ============================================================================
 * A small, dependency-free reactive app. The whole UI is a pure function of
 * `state`; any change re-renders from scratch (cheap for a page this size).
 * Text-input focus, caret position and IME composition are preserved across
 * renders, so editing feels native.
 *
 * Data flow:   event → setState() → save to localStorage → render()
 * Derived UI:  compute(state) → view(vm) → innerHTML
 *
 * The behaviour here mirrors the original CodeDrop design 1:1 (Base64 decode,
 * recipient classification, import parsing, preview, send) — see compute().
 * ============================================================================
 */
(function () {
  "use strict";

  var config = window.CODEDROP_CONFIG || {};
  var I18N = window.CODEDROP_I18N || { en: {} };
  var Sender = window.CodeDropSender;

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var SMTP_DEFAULT = { host: "", port: "", security: "SSL/TLS", user: "", pass: "", fromName: "", fromEmail: "" };
  var STORAGE_KEY = "codedrop:v1";
  var ACCENTS = ["emerald", "blue", "violet"];

  var state = null;
  var app = null;
  var composing = false;
  var pendingRender = false;
  var rafId = null;
  var prevImportOpen = false; // for dialog focus management across renders
  var prevSettingsOpen = false;

  /* ---- small helpers ------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // fmt("Send {n}", 3) -> "Send 3" ; fmt("{n}/{total}", {n:1,total:4}) -> "1/4"
  function fmt(str, vars) {
    str = String(str == null ? "" : str);
    if (vars == null || typeof vars !== "object") return str.split("{n}").join(vars);
    return str.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
  }
  function t() { return I18N[state.lang] || I18N.en; }

  /* ---- domain logic (mirrors the design's DCLogic) ------------------------ */
  function decodeB64(raw) {
    if (config.detectBase64 === false) return null;
    var s = (raw || "").trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
    if (s.length < 8 || s.length % 4 !== 0) return null;
    try { var d = atob(s); if (EMAIL.test(d)) return d; } catch (e) {}
    return null;
  }
  function classify(r) {
    var dec = decodeB64(r.raw);
    var email = dec || (r.raw || "").trim();
    var valid = EMAIL.test(email);
    var hasCode = !!(r.code || "").trim();
    var key;
    if (r.sent) key = "sent";
    else if (!(r.raw || "").trim()) key = "empty";
    else if (!valid) key = "invalid";
    else if (!hasCode) key = "nocode";
    else key = "ready";
    return { isB64: !!dec, email: email, key: key };
  }
  // A row is sendable when it has a valid recipient and a code — independent of
  // whether it was sent before, so the Send button can fire again on every click.
  function isSendable(r) {
    var dec = decodeB64(r.raw);
    var email = dec || (r.raw || "").trim();
    return EMAIL.test(email) && !!(r.code || "").trim();
  }
  function parseImport() {
    var txt = state.importText || "";
    if (state.importMode === "codes") {
      return txt.split(/\s+/).map(function (s) { return s.trim(); }).filter(Boolean)
        .map(function (code) { return { raw: "", code: code }; });
    }
    return txt.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var parts = l.split(/[,\t]| {2,}|\s+/).map(function (p) { return p.trim(); }).filter(Boolean);
      return { raw: parts[0] || "", code: parts[1] || "" };
    });
  }

  /* ---- state ------------------------------------------------------------- */
  function setState(patch) {
    var next = typeof patch === "function" ? patch(state) : patch;
    Object.assign(state, next);
    save();
    scheduleRender();
  }
  function updateRow(id, field, value) {
    setState(function (s) {
      return { rows: s.rows.map(function (r) {
        return r.id === id ? Object.assign({}, r, defObj(field, value), { sent: false }) : r;
      }) };
    });
  }
  function updateSmtp(key, value) {
    setState(function (s) { return { smtp: Object.assign({}, s.smtp, defObj(key, value)) }; });
  }
  function defObj(k, v) { var o = {}; o[k] = v; return o; }

  function addRow() {
    setState(function (s) {
      return { rows: s.rows.concat([{ id: s.nextId, raw: "", code: "", sent: false }]), nextId: s.nextId + 1 };
    });
  }
  function removeRow(id) {
    setState(function (s) { return { rows: s.rows.filter(function (r) { return r.id !== id; }) }; });
  }
  function insertVar() {
    var body = state.body == null ? t().tplBody : state.body;
    var nb = body + ((body.endsWith("\n") || !body) ? "" : " ") + "{{code}}";
    setState({ body: nb });
  }
  function applyProvider(pid) {
    var p = (config.providers || []).find(function (x) { return x.id === pid; });
    if (!p) return;
    setState(function (s) {
      return { smtp: Object.assign({}, s.smtp, { host: p.host, port: p.port, security: p.security }), selectedProvider: p.id };
    });
  }
  function applyImport() {
    var parsed = parseImport();
    if (!parsed.length) { setState({ importOpen: false }); return; }
    var id = state.nextId;
    var added = parsed.map(function (p) { return { id: id++, raw: p.raw, code: p.code, sent: false }; });
    setState(function (s) {
      return { rows: s.rows.concat(added), nextId: id, importOpen: false, importText: "" };
    });
  }
  function saveSettings() {
    setState({ settingsOpen: false });
    toast(t().savedToast, "ok");
  }

  /* ---- sending ----------------------------------------------------------- */
  function send() {
    if (state.sending) return;
    var T = t();
    var ready = state.rows.filter(isSendable);
    if (!ready.length) { toast(T.nothingReady, "warn"); return; }

    var subject = state.subject == null ? T.tplSubject : state.subject;
    var body = state.body == null ? T.tplBody : state.body;
    var messages = ready.map(function (r) {
      var c = classify(r);
      var code = (r.code || "").trim();
      return { id: r.id, to: c.email, subject: subject.split("{{code}}").join(code), body: body.split("{{code}}").join(code) };
    });

    setState({ sending: true });
    Sender.sendBatch(messages, state.smtp, {
      onResult: function (res) {
        if (res.ok) setState(function (s) {
          return { rows: s.rows.map(function (x) { return x.id === res.id ? Object.assign({}, x, { sent: true }) : x; }) };
        });
      },
      onDone: function (sum) {
        setState({ sending: false });
        if (sum.demo) toast(T.demoToast, "warn");
        else if (sum.failed > 0) toast(fmt(T.sentToastErr, { n: sum.sent, e: sum.failed }), "err");
        else toast(fmt(T.sentToast, { n: sum.sent, total: sum.total }), "ok");
      },
    });
  }
  function sendTest() {
    var T = t();
    var sm = state.smtp;
    if (Sender.isReal() && (!sm.host || !sm.user || !sm.pass)) { toast(T.testNeedsSmtp, "warn"); return; }
    var to = sm.fromEmail || sm.user || "test@example.com";
    var subject = state.subject == null ? T.tplSubject : state.subject;
    var body = (state.body == null ? T.tplBody : state.body).split("{{code}}").join("MP-TEST-CODE");
    Sender.sendTest({ id: "test", to: to, subject: "[test] " + subject, body: body }, sm).then(function (res) {
      if (res.demo) toast(T.demoToast, "warn");
      else if (res.ok) toast(fmt(T.testSent, { to: res.to }), "ok");
      else toast(fmt(T.testFail, { e: res.error || "unknown" }), "err");
    });
  }

  /* ---- compute view-model (parity with renderVals) ----------------------- */
  function compute() {
    var T = t();
    var zh = state.lang === "zh";
    var sm = state.smtp;

    var ST = { ready: T.stReady, sent: T.stSent, nocode: T.stNoCode, invalid: T.stInvalid, empty: T.stEmpty };
    var rows = state.rows.map(function (r, i) {
      var c = classify(r);
      return {
        id: r.id, num: String(i + 1).padStart(2, "0"), raw: r.raw, code: r.code,
        isB64: c.isB64, decoded: c.email, statusKey: c.key, statusLabel: ST[c.key],
      };
    });

    var total = rows.length;
    var keys = state.rows.map(function (r) { return classify(r).key; });
    var readyCount = state.rows.filter(isSendable).length; // sendable now — matches send()
    var sentCount = keys.filter(function (k) { return k === "sent"; }).length;

    var first = state.rows.find(function (r) {
      var k = classify(r).key; return k === "ready" || k === "sent" || k === "nocode";
    }) || state.rows[0];
    var previewTo = "name@domain.com", previewCode = "MP-XXXX-XXXX";
    if (first) {
      var fc = classify(first);
      previewTo = fc.email || "name@domain.com";
      previewCode = (first.code || "").trim() || "MP-XXXX-XXXX";
    }
    var subject = state.subject == null ? T.tplSubject : state.subject;
    var body = state.body == null ? T.tplBody : state.body;
    var fill = function (s) { return String(s || "").split("{{code}}").join(previewCode); };
    var previewFrom = (sm.fromName ? sm.fromName + " <" + sm.user + ">" : sm.user) || "you@domain.com";

    var configured = !!(sm.host && sm.port && sm.user && sm.pass);
    var smtpStyle = configured
      ? { cls: "tone-ok", label: T.smtpConnected + " · " + sm.host }
      : { cls: "tone-warn", label: T.smtpNotSet };

    var selProv = (config.providers || []).find(function (p) { return p.id === state.selectedProvider; });
    var isCodes = state.importMode === "codes";
    var parsed = parseImport();
    var detectedCount = parsed.length;
    var detectedPreview = parsed.slice(0, 12).map(function (p) {
      return { label: isCodes ? p.code : ((p.raw || "—") + "  ·  " + (p.code || "—")) };
    });
    var moreCount = Math.max(0, detectedCount - 12);

    return {
      t: T, zh: zh,
      // header / language
      smtpStyle: smtpStyle,
      // sections
      rows: rows, total: total, readyCount: readyCount, sentCount: sentCount,
      rowsReadySummary: total + " " + T.sRows + " · " + readyCount + " " + T.sReady,
      // template
      subject: subject, body: body, showPreview: config.showPreview !== false,
      previewTo: previewTo, previewFrom: previewFrom,
      previewSubject: fill(subject), previewBody: fill(body),
      // action bar
      smtpInlineLabel: configured ? T.via + " " + sm.user : T.configurePrompt,
      smtpInlineOk: configured,
      readyToSend: readyCount + " / " + total + " " + T.readyToSend,
      sentInline: "✓ " + sentCount + " " + T.sent,
      sending: state.sending,
      sendIcon: state.sending ? "◴" : "↗",
      // Always "Send" — never flips to "Sent". Each click re-sends; the button is
      // disabled mid-send (see `sending`) to guard against double-clicks.
      sendLabel: state.sending ? T.sending
        : (readyCount === 1 ? T.sendOne : fmt(T.sendMany, readyCount)),
      // import modal
      importOpen: state.importOpen, isCodes: isCodes,
      importText: state.importText,
      importHint: isCodes ? T.hintCodes : T.hintPairs,
      importPlaceholder: isCodes ? T.phCodes : T.phPairs,
      detectedCount: detectedCount,
      detectedLabel: detectedCount === 0 ? T.detectedNone : fmt(isCodes ? T.detectedCodes : T.detectedRows, detectedCount),
      detectedPreview: detectedPreview, moreCount: moreCount, moreLabel: fmt(T.more, moreCount),
      applyLabel: detectedCount === 0 ? T.addNothing : fmt(isCodes ? T.addCodes : T.addRows, detectedCount),
      // drawer
      settingsOpen: state.settingsOpen, helpOpen: state.helpOpen,
      helpChevron: state.helpOpen ? "▾" : "▸",
      smtp: sm, isStartTls: sm.security === "STARTTLS",
      providers: (config.providers || []).map(function (p) {
        return { id: p.id, name: p.name, selected: state.selectedProvider === p.id };
      }),
      hasSelectedHint: !!selProv,
      selectedHint: selProv ? (zh ? selProv.hintZh : selProv.hintEn) : "",
    };
  }

  /* ---- templates --------------------------------------------------------- */
  function view(vm) {
    return topbar(vm) +
      '<main class="main">' + intro(vm) + sectionTemplate(vm) + sectionRecipients(vm) + "</main>" +
      actionbar(vm) +
      (vm.importOpen ? importModal(vm) : "") +
      (vm.settingsOpen ? drawer(vm) : "");
  }

  function topbar(vm) {
    var T = vm.t;
    var gh = config.github || {};
    var star = gh.show === false ? "" :
      '<a class="btn btn--dark topbar__star" href="' + esc(gh.url || "#") + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(T.star) + '">' +
        '<span class="btn__ico">★</span>' +
        '<span class="topbar__star-label"> ' + esc(T.star) +
          (gh.stars ? ' <span class="btn__muted">' + esc(gh.stars) + "</span>" : "") +
        "</span>" +
      "</a>";
    return '' +
    '<header class="topbar">' +
      '<div class="brand">' +
        '<div class="brand__logo">›</div>' +
        '<div class="brand__text">' +
          '<span class="brand__name">' + esc(config.appName || "codedrop") + "</span>" +
          (config.version ? '<span class="brand__ver">' + esc(config.version) + "</span>" : "") +
        "</div>" +
      "</div>" +
      '<div class="topbar__right">' +
        '<div class="seg" role="group" aria-label="Language">' +
          '<button class="seg__btn" data-action="lang" data-lang="zh" aria-selected="' + vm.zh + '" aria-label="中文 / Chinese">中</button>' +
          '<button class="seg__btn" data-action="lang" data-lang="en" aria-selected="' + (!vm.zh) + '" aria-label="English">EN</button>' +
        "</div>" +
        '<div class="pill ' + vm.smtpStyle.cls + '"><span class="dot"></span>' + esc(vm.smtpStyle.label) + "</div>" +
        '<button class="btn btn--light" data-action="toggle-settings"><span class="btn__ico">⚙</span> ' + esc(T.smtpBtn) + "</button>" +
        star +
      "</div>" +
    "</header>";
  }

  function intro(vm) {
    return '<div class="intro"><h1 class="intro__title">' + esc(vm.t.introTitle) + "</h1>" +
      '<p class="intro__body">' + esc(vm.t.introBody) + "</p></div>";
  }

  function sectionTemplate(vm) {
    var T = vm.t;
    var preview = vm.showPreview ?
      '<div class="preview">' +
        '<div class="preview__head"><span class="preview__dot"></span><span class="preview__tag">' + esc(T.previewTag) + "</span></div>" +
        '<div class="preview__meta">' +
          '<div><span class="preview__k">' + esc(T.toL) + "</span> " + esc(vm.previewTo) + "</div>" +
          '<div><span class="preview__k">' + esc(T.fromL) + "</span> " + esc(vm.previewFrom) + "</div>" +
          '<div><span class="preview__k">' + esc(T.subjL) + '</span> <span class="preview__subj">' + esc(vm.previewSubject) + "</span></div>" +
        "</div>" +
        '<div class="preview__body">' + esc(vm.previewBody) + "</div>" +
      "</div>" : "";

    return '' +
    '<div class="sec"><span class="sec__num">01</span><span class="sec__label">' + esc(T.secTemplate) + '</span><span class="sec__rule"></span></div>' +
    '<div class="tpl-grid' + (vm.showPreview ? "" : " tpl-grid--single") + '">' +
      '<div class="card">' +
        '<label class="field-label" id="lbl-subject">' + esc(T.subjectLabel) + "</label>" +
        '<input class="input" data-field="subject" data-fk="subject" aria-labelledby="lbl-subject" value="' + esc(vm.subject) + '">' +
        '<div class="tpl-row">' +
          '<label class="field-label" id="lbl-body">' + esc(T.bodyLabel) + "</label>" +
          '<button class="token-btn" data-action="insert-var">+ ' + esc(T.insertVar) + " {{code}}</button>" +
        "</div>" +
        '<textarea class="textarea" data-field="body" data-fk="body" aria-labelledby="lbl-body" rows="9">' + esc(vm.body) + "</textarea>" +
        '<p class="hint">' + esc(T.tokenHintPre) + ' <span class="hint--token">{{code}}</span> ' + esc(T.tokenHintPost) + "</p>" +
      "</div>" +
      preview +
    "</div>";
  }

  function rowTpl(r, vm) {
    var T = vm.t;
    var b64 = r.isB64 ?
      '<div class="b64"><span class="b64__tag">BASE64</span><span class="b64__arrow">→</span><span class="b64__val">' + esc(r.decoded) + "</span></div>" : "";
    return '' +
    '<div class="rec-grid rec-row" data-row-id="' + r.id + '">' +
      '<span class="rec-num">' + esc(r.num) + "</span>" +
      '<div class="rec-cell">' +
        '<input class="input" data-field="row-raw" data-id="' + r.id + '" data-fk="row-' + r.id + '-raw" aria-label="' + esc(T.colRecipient + " " + r.num) + '" value="' + esc(r.raw) + '" placeholder="' + esc(T.emailPlaceholder) + '">' +
        b64 +
      "</div>" +
      '<div class="rec-cell rec-cell--code">' +
        '<input class="input" data-field="row-code" data-id="' + r.id + '" data-fk="row-' + r.id + '-code" aria-label="' + esc(T.colCode + " " + r.num) + '" value="' + esc(r.code) + '" placeholder="MP-XXXX-XXXX">' +
      "</div>" +
      '<div class="status-cell col-status">' +
        '<span class="status status--' + r.statusKey + '"><span class="dot"></span>' + esc(r.statusLabel) + "</span>" +
      "</div>" +
      '<button class="icon-btn" data-action="remove-row" data-id="' + r.id + '" aria-label="Remove">×</button>' +
    "</div>";
  }

  function sectionRecipients(vm) {
    var T = vm.t;
    return '' +
    '<div class="sec">' +
      '<span class="sec__num">02</span>' +
      '<span class="sec__label">' + esc(T.secRecipients) + "</span>" +
      '<span class="sec__meta">' + esc(vm.rowsReadySummary) + "</span>" +
      '<span class="sec__rule"></span>' +
      '<button class="btn btn--dark" data-action="open-import">↓ ' + esc(T.importBtn) + "</button>" +
      '<button class="btn btn--light" data-action="add-row">+ ' + esc(T.addRowBtn) + "</button>" +
    "</div>" +
    '<div class="table">' +
      '<div class="rec-grid table__head">' +
        "<span>#</span><span>" + esc(T.colRecipient) + '</span><span class="col-code">' + esc(T.colCode) + '</span><span class="col-status">' + esc(T.colStatus) + "</span><span></span>" +
      "</div>" +
      vm.rows.map(function (r) { return rowTpl(r, vm); }).join("") +
      '<button class="add-row" data-action="add-row" aria-label="' + esc(T.addRecipient) + '"><span class="add-row__plus" aria-hidden="true">+</span>' + esc(T.addRecipient) + "</button>" +
    "</div>";
  }

  function actionbar(vm) {
    var sent = vm.sentCount > 0 ?
      '<span class="divider">|</span><span class="actionbar__sent">' + esc(vm.sentInline) + "</span>" : "";
    return '' +
    '<div class="actionbar"><div class="actionbar__inner">' +
      '<div class="actionbar__meta">' +
        '<span class="muted">' + esc(vm.readyToSend) + "</span>" +
        '<span class="divider">|</span>' +
        '<span class="actionbar__via ' + (vm.smtpInlineOk ? "is-ok" : "is-warn") + '">' + esc(vm.smtpInlineLabel) + "</span>" +
        sent +
      "</div>" +
      '<button class="send-btn" data-action="send"' + (vm.sending ? " disabled" : "") + ">" +
        '<span class="send-btn__ico' + (vm.sending ? " send-btn__ico--spin" : "") + '">' + vm.sendIcon + "</span> " + esc(vm.sendLabel) +
      "</button>" +
    "</div></div>";
  }

  function importModal(vm) {
    var T = vm.t;
    var chips = vm.detectedCount > 0 ?
      '<div class="chips">' +
        vm.detectedPreview.map(function (c) { return '<span class="chip">' + esc(c.label) + "</span>"; }).join("") +
        (vm.moreCount ? '<span class="chip--more">' + esc(vm.moreLabel) + "</span>" : "") +
      "</div>" : "";
    var disabled = vm.detectedCount === 0;
    return '' +
    '<div class="overlay" data-k="overlay" data-action="overlay-import">' +
      '<div class="modal" data-stop role="dialog" aria-modal="true" aria-label="' + esc(T.importTitle) + '">' +
        '<div class="modal__head">' +
          "<div><div class=\"modal__title\">" + esc(T.importTitle) + '</div><div class="modal__sub">' + esc(T.importSub) + "</div></div>" +
          '<button class="close-btn" data-action="close-import" aria-label="Close">×</button>' +
        "</div>" +
        '<div class="modal__body">' +
          '<div class="seg seg--tall" role="group" aria-label="Import mode">' +
            '<button class="seg__btn" data-action="import-mode" data-mode="codes" aria-selected="' + vm.isCodes + '">' + esc(T.modeCodesOnly) + "</button>" +
            '<button class="seg__btn" data-action="import-mode" data-mode="pairs" aria-selected="' + (!vm.isCodes) + '">' + esc(T.modeEmailCode) + "</button>" +
          "</div>" +
          '<p class="modal-hint">' + esc(vm.importHint) + "</p>" +
          '<textarea class="textarea" data-field="import" data-fk="import" rows="9" placeholder="' + esc(vm.importPlaceholder) + '">' + esc(vm.importText) + "</textarea>" +
        "</div>" +
        '<div class="import-detect">' +
          '<div class="import-detect__label ' + (disabled ? "is-none" : "is-ok") + '">' + esc(vm.detectedLabel) + "</div>" +
          chips +
        "</div>" +
        '<div class="modal__foot">' +
          '<button class="btn-secondary" data-action="close-import">' + esc(T.cancel) + "</button>" +
          '<button class="btn-apply ' + (disabled ? "btn-apply--off" : "btn-apply--on") + '" data-action="apply-import"' + (disabled ? " disabled" : "") + ">" + esc(vm.applyLabel) + "</button>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function drawer(vm) {
    var T = vm.t;
    var sm = vm.smtp;
    var tip = vm.hasSelectedHint ?
      '<div class="tip"><span class="tip__dot"></span><span><strong>' + esc(T.appPassTip) + "</strong> " + esc(vm.selectedHint) + "</span></div>" : "";
    var help = vm.helpOpen ?
      '<div class="help"><p>' + esc(T.helpP1) + "</p>" +
        '<div class="help__card"><div class="help__card-title">' + esc(T.appPassTitle) + "</div><p>" + esc(T.appPassBody) + "</p></div>" +
      "</div>" : "";
    function field(label, key, type, ph) {
      return '<div class="field"><label class="field-label">' + esc(label) + "</label>" +
        '<input class="input"' + (type ? ' type="' + type + '"' : "") +
        ' data-field="smtp-' + key + '" data-fk="smtp-' + key + '" value="' + esc(sm[key]) + '" placeholder="' + esc(ph) + '"></div>';
    }
    return '' +
    '<div class="drawer-scrim" data-k="drawer-scrim" data-action="close-settings"></div>' +
    '<aside class="drawer" data-k="drawer" role="dialog" aria-modal="true" aria-label="' + esc(T.smtpConfig) + '">' +
      '<div class="drawer__head">' +
        "<div><div class=\"drawer__title\">" + esc(T.smtpConfig) + '</div><div class="drawer__sub">' + esc(T.smtpConfigSub) + "</div></div>" +
        '<button class="close-btn" data-action="toggle-settings" aria-label="Close">×</button>' +
      "</div>" +
      '<div class="drawer__body">' +
        '<div class="quick">' +
          '<label class="field-label">' + esc(T.quickSetup) + "</label>" +
          '<p class="quick__sub">' + esc(T.quickSetupSub) + "</p>" +
          '<div class="providers">' +
            vm.providers.map(function (p) {
              return '<button class="provider-btn" data-action="provider" data-id="' + esc(p.id) + '" aria-pressed="' + p.selected + '">' + esc(p.name) + "</button>";
            }).join("") +
          "</div>" + tip +
        "</div>" +
        '<div class="rule" style="margin-bottom:18px"></div>' +
        '<div class="drawer__fields">' +
          field(T.fHost, "host", "", T.phHost) +
          '<div class="grid-2">' +
            field(T.fPort, "port", "", T.phPort) +
            '<div class="field"><label class="field-label">' + esc(T.fSecurity) + "</label>" +
              '<div class="sec-toggle" role="group" aria-label="Security">' +
                '<button class="seg__btn" data-action="security" data-sec="SSL/TLS" aria-selected="' + (!vm.isStartTls) + '">SSL/TLS</button>' +
                '<button class="seg__btn" data-action="security" data-sec="STARTTLS" aria-selected="' + vm.isStartTls + '">STARTTLS</button>' +
              "</div>" +
            "</div>" +
          "</div>" +
          field(T.fUser, "user", "", T.phUser) +
          field(T.fPass, "pass", "password", T.phPass) +
          '<div class="rule" style="margin:4px 0"></div>' +
          '<div class="grid-2">' +
            field(T.fFromName, "fromName", "", T.phFromName) +
            field(T.fFromEmail, "fromEmail", "", T.phFromEmail) +
          "</div>" +
        "</div>" +
        '<div class="drawer-pill ' + vm.smtpStyle.cls + '"><span class="dot"></span>' + esc(vm.smtpStyle.label) + "</div>" +
        '<div class="drawer__actions">' +
          '<button class="btn-block btn-block--light" data-action="send-test">' + esc(T.sendTest) + "</button>" +
          '<button class="btn-block btn-block--dark" data-action="save-settings">' + esc(T.save) + "</button>" +
        "</div>" +
        '<button class="help-toggle" data-action="toggle-help"><span class="help-toggle__chev">' + vm.helpChevron + "</span> " + esc(T.helpToggle) + "</button>" +
        help +
        '<p class="drawer__note">' + esc(T.drawerNote) + "</p>" +
      "</div>" +
    "</aside>";
  }

  /* ---- events ------------------------------------------------------------ */
  function onClick(e) {
    var stop = e.target.closest("[data-stop]");
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var a = el.dataset.action;
    switch (a) {
      case "overlay-import": if (!stop) setState({ importOpen: false }); break;
      case "lang":
        setState({ lang: el.dataset.lang });
        document.documentElement.setAttribute("lang", el.dataset.lang === "zh" ? "zh-CN" : "en");
        break;
      case "toggle-settings": setState(function (s) { return { settingsOpen: !s.settingsOpen }; }); break;
      case "close-settings": setState({ settingsOpen: false }); break;
      case "open-import": setState({ importOpen: true }); break;
      case "close-import": setState({ importOpen: false }); break;
      case "insert-var": insertVar(); break;
      case "add-row": addRow(); break;
      case "remove-row": removeRow(+el.dataset.id); break;
      case "import-mode": setState({ importMode: el.dataset.mode }); break;
      case "apply-import": applyImport(); break;
      case "provider": applyProvider(el.dataset.id); break;
      case "security": setState(function (s) { return { smtp: Object.assign({}, s.smtp, { security: el.dataset.sec }) }; }); break;
      case "toggle-help": setState(function (s) { return { helpOpen: !s.helpOpen }; }); break;
      case "save-settings": saveSettings(); break;
      case "send-test": sendTest(); break;
      case "send": send(); break;
    }
  }
  function onInput(e) {
    var el = e.target.closest("[data-field]");
    if (!el) return;
    var f = el.dataset.field, v = el.value;
    if (f === "subject") setState({ subject: v });
    else if (f === "body") setState({ body: v });
    else if (f === "import") setState({ importText: v });
    else if (f === "row-raw") updateRow(+el.dataset.id, "raw", v);
    else if (f === "row-code") updateRow(+el.dataset.id, "code", v);
    else if (f.indexOf("smtp-") === 0) updateSmtp(f.slice(5), v);
  }
  function onKeydown(e) {
    if (e.key === "Escape") {
      if (state.importOpen) setState({ importOpen: false });
      else if (state.settingsOpen) setState({ settingsOpen: false });
      return;
    }
    if (e.key === "Tab") trapTab(e);
  }

  /* ---- render (with focus + IME preservation) ---------------------------- */
  function scheduleRender() {
    if (composing) { pendingRender = true; return; }
    if (rafId) return;
    rafId = requestAnimationFrame(function () { rafId = null; render(); });
  }
  function render() {
    var active = document.activeElement;
    var fk = active && active.dataset ? active.dataset.fk : null;
    var ss = null, se = null;
    if (fk) { try { ss = active.selectionStart; se = active.selectionEnd; } catch (e) {} }

    // Reconcile the DOM in place instead of replacing innerHTML. Persisting the
    // existing nodes keeps focus/caret/IME intact and — crucially — stops the
    // drawer & modal from replaying their open animation on every keystroke.
    var tpl = document.createElement("template");
    tpl.innerHTML = view(compute());
    morphChildren(app, tpl.content);

    // Safety net: if the focused field was somehow replaced, restore focus+caret.
    if (fk) {
      var el = app.querySelector('[data-fk="' + fk + '"]');
      if (el && el !== document.activeElement) {
        el.focus();
        if (ss != null) { try { el.setSelectionRange(ss, se); } catch (e) {} }
      }
    }
    manageDialogFocus();
  }

  /* ---- DOM morph (in-place reconciliation) ------------------------------- */
  // A tiny morphdom-style diff: reuse existing nodes where the tag (and key, if
  // any) match, update only what changed, and add/remove the rest. Keyed nodes
  // (data-k / data-fk / data-row-id / id) match by key; others match by position.
  function keyOf(node) {
    if (!node || node.nodeType !== 1) return null;
    return node.getAttribute("data-k") || node.getAttribute("data-fk") ||
      node.getAttribute("data-row-id") || node.id || null;
  }
  function sameType(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType === 1) return a.tagName === b.tagName;
    return true;
  }
  function syncAttrs(oldEl, newEl) {
    var na = newEl.attributes, oa = oldEl.attributes, i;
    for (i = 0; i < na.length; i++) {
      if (oldEl.getAttribute(na[i].name) !== na[i].value) oldEl.setAttribute(na[i].name, na[i].value);
    }
    for (i = oa.length - 1; i >= 0; i--) {
      if (!newEl.hasAttribute(oa[i].name)) oldEl.removeAttribute(oa[i].name);
    }
    // Boolean props don't reliably follow their attribute — set them explicitly.
    if ("disabled" in oldEl) oldEl.disabled = newEl.hasAttribute("disabled");
  }
  function morphNode(oldNode, newNode) {
    if (oldNode.nodeType !== 1) {
      if (oldNode.nodeValue !== newNode.nodeValue) oldNode.nodeValue = newNode.nodeValue;
      return;
    }
    syncAttrs(oldNode, newNode);
    var tag = oldNode.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      // Value lives in a property, not just an attribute. Never clobber the field
      // the user is typing into; otherwise push the latest value from state.
      var desired = tag === "TEXTAREA" ? newNode.value : (newNode.getAttribute("value") || "");
      if (oldNode !== document.activeElement && oldNode.value !== desired) oldNode.value = desired;
      return;
    }
    morphChildren(oldNode, newNode);
  }
  function morphChildren(oldParent, newParent) {
    var oldNodes = Array.prototype.slice.call(oldParent.childNodes);
    var newNodes = Array.prototype.slice.call(newParent.childNodes);

    var oldByKey = {};
    oldNodes.forEach(function (n) { var k = keyOf(n); if (k != null && !(k in oldByKey)) oldByKey[k] = n; });

    var used = [];
    var up = 0; // cursor for positional (unkeyed) matching
    var result = newNodes.map(function (nn) {
      var nk = keyOf(nn), reuse = null;
      if (nk != null && oldByKey[nk] && used.indexOf(oldByKey[nk]) < 0 && sameType(oldByKey[nk], nn)) {
        reuse = oldByKey[nk];
      } else {
        while (up < oldNodes.length) {
          var cand = oldNodes[up++];
          if (used.indexOf(cand) >= 0 || keyOf(cand) != null) continue;
          if (sameType(cand, nn)) { reuse = cand; break; }
        }
      }
      if (reuse) { used.push(reuse); morphNode(reuse, nn); return reuse; }
      return document.importNode(nn, true);
    });

    oldNodes.forEach(function (n) { if (used.indexOf(n) < 0 && n.parentNode === oldParent) oldParent.removeChild(n); });
    for (var i = 0; i < result.length; i++) {
      var node = result[i], current = oldParent.childNodes[i] || null;
      if (current !== node) oldParent.insertBefore(node, current);
    }
  }

  // Move focus into a dialog when it opens; return it to the trigger when it closes.
  function manageDialogFocus() {
    if (state.importOpen && !prevImportOpen) focusInto(".modal");
    else if (state.settingsOpen && !prevSettingsOpen) focusInto(".drawer");
    if (!state.importOpen && prevImportOpen) focusAction("open-import");
    if (!state.settingsOpen && prevSettingsOpen) focusAction("toggle-settings");
    prevImportOpen = state.importOpen;
    prevSettingsOpen = state.settingsOpen;
  }
  function focusInto(sel) {
    var c = app.querySelector(sel);
    if (!c) return;
    var el = c.querySelector('textarea, input:not([type="hidden"])') || c.querySelector("button:not([disabled]), a[href]");
    if (el) el.focus();
  }
  function focusAction(action) {
    var el = app.querySelector('[data-action="' + action + '"]');
    if (el) el.focus();
  }
  // Keep Tab focus inside the open dialog (focus trap).
  function trapTab(e) {
    var c = state.importOpen ? app.querySelector(".modal") : (state.settingsOpen ? app.querySelector(".drawer") : null);
    if (!c) return;
    var f = c.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---- persistence ------------------------------------------------------- */
  function load() {
    if (config.persist === false) return {};
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function save() {
    if (config.persist === false) return;
    try {
      var smtp = Object.assign({}, state.smtp);
      if (config.persistSmtpPassword === false) smtp.pass = "";
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lang: state.lang, smtp: smtp, rows: state.rows, nextId: state.nextId,
        subject: state.subject, body: state.body, selectedProvider: state.selectedProvider,
      }));
    } catch (e) {}
  }

  /* ---- toast ------------------------------------------------------------- */
  function toast(msg, kind) {
    var root = document.getElementById("toast-root");
    if (!root) return;
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " toast--" + kind : "");
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(function () { el.remove(); }, 320);
    }, 3200);
  }

  /* ---- init -------------------------------------------------------------- */
  function init() {
    app = document.getElementById("app");
    if (!app) return;

    var saved = load();
    var seed = (config.seedRows || []).map(function (r, i) {
      return { id: i + 1, raw: r.raw || "", code: r.code || "", sent: false };
    });
    var lang = (saved.lang && I18N[saved.lang]) ? saved.lang : (I18N[config.defaultLang] ? config.defaultLang : "en");

    state = {
      lang: lang,
      settingsOpen: false, helpOpen: false, importOpen: false, sending: false,
      importMode: "codes", importText: "",
      selectedProvider: saved.selectedProvider || null,
      subject: saved.subject !== undefined ? saved.subject : null,
      body: saved.body !== undefined ? saved.body : null,
      smtp: Object.assign({}, SMTP_DEFAULT, saved.smtp || {}),
      rows: (Array.isArray(saved.rows) && saved.rows.length)
        ? saved.rows.map(function (r) { return { id: r.id, raw: r.raw || "", code: r.code || "", sent: !!r.sent }; })
        : seed,
      nextId: saved.nextId || (seed.length + 1),
    };
    var maxId = state.rows.reduce(function (m, r) { return Math.max(m, r.id || 0); }, 0);
    if (!state.nextId || state.nextId <= maxId) state.nextId = maxId + 1;

    var accent = ACCENTS.indexOf(config.accent) >= 0 ? config.accent : "emerald";
    document.documentElement.setAttribute("data-accent", accent);
    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");

    render();
    app.addEventListener("click", onClick);
    app.addEventListener("input", onInput);
    app.addEventListener("compositionstart", function () { composing = true; });
    app.addEventListener("compositionend", function () {
      composing = false;
      if (pendingRender) { pendingRender = false; scheduleRender(); }
    });
    document.addEventListener("keydown", onKeydown);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
