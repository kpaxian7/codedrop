/*
 * CodeDrop — configuration
 * ============================================================================
 * This is the ONE file most self-hosters need to edit. Everything here is
 * read at startup and used to brand, theme and wire up the app. No build step
 * is required — just edit the values below and reload the page.
 *
 * The default email template (subject + body) and all UI copy live in
 * `assets/js/i18n.js`, so edit that file to customise your campaign wording.
 * ============================================================================
 */
window.CODEDROP_CONFIG = {
  /* ---- Branding ---------------------------------------------------------- */
  appName: "codedrop", // shown next to the logo
  version: "v0.1.0", // small label after the name; set to "" to hide

  /* ---- Defaults ---------------------------------------------------------- */
  defaultLang: "en", // "en" | "zh" — initial language (a user toggle overrides & persists)
  accent: "emerald", // "emerald" | "blue" | "violet" — primary colour
  showPreview: true, // show the live email preview pane next to the editor
  detectBase64: true, // auto-decode Base64 email addresses in the recipient table

  /* ---- "Star on GitHub" button ------------------------------------------ */
  github: {
    show: true, // set false to hide the button entirely
    url: "https://github.com/kpaxian7/codedrop", // ← point this at your repo
    stars: "1.2k", // text shown after the star; set to "" to hide the count
  },

  /* ---- Persistence ------------------------------------------------------- */
  // The template, recipient list and SMTP settings are saved to the browser's
  // localStorage so a reload doesn't lose your work.
  persist: true, // master switch for localStorage persistence (template, recipients, SMTP host/user…)
  // The SMTP password is the one secret here. It is NOT persisted by default —
  // you re-enter it each session. Flip to true for single-user machines where
  // convenience outweighs the risk of it sitting in localStorage.
  persistSmtpPassword: false,

  /* ---- Sending ----------------------------------------------------------
   * Browsers cannot speak SMTP directly, so real sending needs a tiny backend.
   *   - endpoint: null  -> DEMO MODE. Nothing is sent; rows are marked "sent"
   *                        with a short animation so you can try the UI safely.
   *   - endpoint: "..." -> REAL MODE. The app POSTs the batch to this URL and
   *                        marks each row by the per-recipient result it returns.
   *
   * A ready-to-run reference backend lives in `examples/server/` and implements
   * the exact contract documented in the README. Point `endpoint` at it, e.g.
   * "http://localhost:8787/api/send", and you're sending for real.
   * --------------------------------------------------------------------- */
  api: {
    endpoint: null, // e.g. "http://localhost:8787/api/send"
    headers: {}, // optional extra headers, e.g. { "x-api-key": "…" }
  },

  /* ---- SMTP provider quick-presets --------------------------------------
   * The buttons under "Quick setup" in the SMTP drawer. Picking one fills in
   * host / port / security automatically. Add, remove or reorder freely.
   * `hintEn` / `hintZh` describe where to generate an app-specific password.
   * --------------------------------------------------------------------- */
  providers: [
    { id: "gmail",    name: "Gmail",     host: "smtp.gmail.com",         port: "465", security: "SSL/TLS",  hintEn: "Google Account → Security → 2-Step Verification → App passwords.",                                        hintZh: "Google 账户 → 安全性 → 两步验证 → 应用专用密码。" },
    { id: "outlook",  name: "Outlook",   host: "smtp-mail.outlook.com",  port: "587", security: "STARTTLS", hintEn: "account.live.com → Security → Advanced security → Create a new app password.",                            hintZh: "account.live.com → 安全 → 高级安全选项 → 创建新的应用密码。" },
    { id: "fastmail", name: "Fastmail",  host: "smtp.fastmail.com",      port: "465", security: "SSL/TLS",  hintEn: "Settings → Privacy & Security → App passwords → New password.",                                          hintZh: "设置 → 隐私与安全 → 应用密码 → 新建密码。" },
    { id: "icloud",   name: "iCloud",    host: "smtp.mail.me.com",       port: "587", security: "STARTTLS", hintEn: "appleid.apple.com → Sign-In & Security → App-Specific Passwords.",                                       hintZh: "appleid.apple.com → 登录与安全 → App 专用密码。" },
    { id: "qq",       name: "QQ 邮箱",   host: "smtp.qq.com",            port: "465", security: "SSL/TLS",  hintEn: "Settings → Account → enable SMTP service, then use the authorization code as the password.",            hintZh: "设置 → 账户 → 开启 SMTP 服务，将“授权码”作为密码填入。" },
    { id: "n163",     name: "163 邮箱",  host: "smtp.163.com",           port: "465", security: "SSL/TLS",  hintEn: "Settings → POP3/SMTP/IMAP → enable the service, then use the authorization code.",                       hintZh: "设置 → POP3/SMTP/IMAP → 开启服务，使用“授权码”作为密码。" },
  ],

  /* ---- Seed recipients ---------------------------------------------------
   * Example rows shown on first load (before anything is saved). Set to []
   * to start empty. `raw` may be a plain email or a Base64-encoded one.
   * --------------------------------------------------------------------- */
  seedRows: [
    { raw: "jordan@example.com",        code: "MP-4F9K-22XQ" },
    { raw: "dXNlckBleGFtcGxlLmNvbQ==",  code: "MP-77AB-91MN" },
    { raw: "taylor@indiehacker.dev",    code: "MP-1ZK0-58PQ" },
    { raw: "ZGV2QG1haWwuY29t",          code: "MP-9QW3-44LD" },
    { raw: "sam@buildspace.so",         code: "" },
  ],
};
