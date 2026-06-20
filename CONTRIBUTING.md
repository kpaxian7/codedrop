# Contributing to CodeDrop

Thanks for taking the time! CodeDrop is intentionally tiny and dependency-free,
and we'd like to keep it that way.

## Ground rules

- **No build step for the front-end.** It's plain HTML/CSS/JS that runs by
  opening `index.html`. Please don't add a bundler, framework, or transpiler.
- **No runtime dependencies** in the front-end. The only dependency in the repo
  is `nodemailer`, used by the optional `examples/server/` backend.
- **Keep it readable.** Match the existing style: small functions, comments that
  explain *why*, and the same naming conventions as the surrounding code.

## Project map

| File | Responsibility |
| --- | --- |
| `assets/js/config.js` | User-facing configuration (branding, providers, endpoint). |
| `assets/js/i18n.js` | All UI strings + the default email template, per language. |
| `assets/js/send.js` | Demo/real send abstraction and the backend contract. |
| `assets/js/app.js` | State, the `compute()` view-model, rendering, and behaviour. |
| `assets/css/styles.css` | Design tokens (`:root`) + component styles. |

## Local development

```bash
python3 -m http.server 5173   # or: npx serve .
# open http://localhost:5173
```

To test real sending, run the backend (`examples/server`) and set
`api.endpoint` in `config.js`.

## Making changes

1. Fork and branch from the default branch.
2. Keep PRs focused; describe the change and how you tested it.
3. Test both languages (中 / EN) and both demo and real send paths if you touch
   sending. Check the import modal, the SMTP drawer, and mobile width.
4. If you add a config option, document it in `config.js` and the README table.

## Adding a language

1. In `assets/js/i18n.js`, copy the `en` block to a new key (e.g. `de`) and
   translate every value.
2. In `assets/js/app.js` → `topbar()`, add a button to the language `seg`.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what happened
(browser + OS help). Never paste real SMTP credentials into an issue.
