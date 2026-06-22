<div align="center">

# › codedrop

**用你自己的 SMTP，一键群发兑换码。**

为每位收件人分配一个一次性兑换码，写一份带 `{{code}}` 占位符的模板，然后从你
自己的邮箱把整批发出去。无需构建步骤、无需 SaaS、无厂商绑定 —— 一个静态页面，
外加一个可选的百来行后端。

[![Live demo](https://img.shields.io/badge/demo-live-1c7a4d.svg)](https://kpaxian7.github.io/codedrop/)
[![CI](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml/badge.svg)](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)
![No build step](https://img.shields.io/badge/build-none-brightgreen.svg)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-1c7a4d.svg)](CONTRIBUTING.md)

**🔗 [在线 Demo](https://kpaxian7.github.io/codedrop/)** —— 运行在演示模式（不会真正发信）。

[快速开始](#快速开始) · [配置](#配置) · [部署](#部署) · [开启真实发送](#开启真实发送) · [安全](#安全须知)

[English](README.md) · **中文**

</div>

---

## 它能做什么

CodeDrop 是一个小巧的自托管工具，专门解决一个很常见的需求：「我手上有一堆
兑换码 / 授权码 / 邀请码，还有一份收件人名单，需要发出去。」

- **模板 + 占位符**：邮件只写一次，`{{code}}` 会按每位收件人替换。边写边预览。
- **收件人表格**：粘贴或输入邮箱与兑换码，每行显示状态（`就绪` / `缺兑换码` /
  `无效` / `空` / `已发送`）。
- **支持 Base64**：邮箱栏既接受普通地址，也接受 Base64 —— 编码过的会自动解码。
- **批量导入**：粘贴一整段兑换码，或 `邮箱, 兑换码` 配对（逗号 / 制表符 / 空格
  分隔），自动拆分成多行。
- **自带 SMTP**：内置 Gmail、Outlook、Fastmail、iCloud、QQ、163 的快速预设，
  并为每家附上「应用专用密码」的获取路径。
- **双语**：开箱即带英文与中文；再加语言只需改一个文件。
- **本地持久化**：模板、收件人、SMTP 配置都存进 `localStorage`，刷新不丢。

> **默认演示模式。** 开箱即用时不会真正发信 —— 「发送」按钮跑的是一段逼真的
> 模拟，方便你安全试用。准备好后再[开启真实发送](#开启真实发送)。

## 快速开始

它是一个纯静态站点。克隆下来，把目录跑起来即可 —— 任选一种：

```bash
git clone https://github.com/kpaxian7/codedrop.git
cd codedrop

# 方式 A —— npm 脚本（底层用 Python）
npm run dev          # http://localhost:5173

# 方式 B —— 直接用 Python
python3 -m http.server 5173

# 方式 C —— 用 Node
npx serve .

# 方式 D —— 直接在浏览器里打开 index.html
```

然后访问 `http://localhost:5173`。就这样 —— 你已经在演示模式里了（不会真的发信）。
准备好后见[开启真实发送](#开启真实发送)。

## 项目结构

```
codedrop/
├── index.html              # 页面入口；按顺序加载下面的脚本
├── assets/
│   ├── css/styles.css      # 全部样式（设计 token 在文件顶部）
│   ├── favicon.svg
│   └── js/
│       ├── config.js       # ← 改我：品牌、主题色、服务商、发送端点
│       ├── i18n.js         # ← 改我：全部界面文案 + 默认邮件模板
│       ├── send.js         # demo / 真实发送的抽象（后端契约）
│       └── app.js          # 状态 + 渲染 + 交互（零依赖）
└── examples/
    └── server/             # 可选的参考后端（Node + nodemailer）
```

## 配置

几乎所有你想自定义的东西都在 **`assets/js/config.js`** —— 改完刷新即可，无需构建：

| 配置项 | 作用 |
| --- | --- |
| `appName`、`version` | Logo 旁显示的品牌信息。 |
| `defaultLang` | `"en"` 或 `"zh"` —— 初始语言。 |
| `accent` | `"emerald"`、`"blue"` 或 `"violet"`。 |
| `showPreview` | 是否显示实时邮件预览面板。 |
| `detectBase64` | 是否自动解码 Base64 邮箱地址。 |
| `github` | 「Star」按钮（`url`、`stars`、`show`）。 |
| `persist` / `persistSmtpPassword` | localStorage 持久化行为。 |
| `api.endpoint` | `null` = 自动探测自带后端（否则演示模式）；填 URL = 真实发送。 |
| `providers` | SMTP 快速预设（可自行增删）。 |
| `seedRows` | 首次加载时的示例行。 |

**默认邮件文案**（主题 + 正文）和**所有可见文字**都在 **`assets/js/i18n.js`** 的
`tplSubject` / `tplBody` 里，改这里就能把内容换成你自己的。要新增一门语言：复制
`en` 整块、翻译后以新键加入，再到 `assets/js/app.js` 的 `topbar()` 里加一个按钮。

## 部署

因为是纯静态，部署就是「把这些文件传上去」：

- **GitHub Pages** —— 推送仓库，在默认分支（根目录）启用 Pages。仓库已内置
  `.github/workflows/pages.yml`，在 Settings → Pages → Source 选「GitHub Actions」即可自动部署。
- **Netlify / Cloudflare Pages / Vercel** —— 新建项目，不设构建命令，发布目录
  填 `.`（仓库根目录）。
- **任意 Web 服务器** —— 把整个目录拷进网站根目录（nginx / Apache / Caddy）。

静态站点本身不需要任何环境变量；它们只在你运行[后端](#开启真实发送)时才用得到。

## 开启真实发送

浏览器无法直接建立 SMTP 连接（而且把 SMTP 密码塞进静态页面会暴露给每个访客），
所以真实发送需要一个小后端。仓库里有一个开箱即用的：[`examples/server/`](examples/server/) ——
它还会**顺带托管前端**，所以是**一条命令、无需改配置**：

```bash
cd examples/server
npm install
npm start                      # 打开 http://localhost:8787
```

打开它打印的地址即可真实发信。前端会探测 `GET /health`，发现后端后自动从演示模式
切换到真实发送，**不用动 config.js**。若从没有后端的静态站点（比如 GitHub Pages
那个 demo）打开，探测失败，就安全地保持演示模式。

想把前端单独部署（静态托管 + 后端在另一个域名）？那就显式填 endpoint —— 显式值
会覆盖自动探测：

```js
api: { endpoint: "https://your-backend.example.com/api/send" }
```

后端的 SMTP 凭据可以来自界面（默认），也可以来自它自己的 `.env`（设
`SMTP_FROM_ENV=true`，适合多人共享部署）。完整契约与部署说明见[后端
README](examples/server/README.md)。任何实现了同样 `POST /api/send` 契约的服务器
都能用 —— 你也可以把 CodeDrop 接到自己的后端上。

## 安全须知

CodeDrop **刻意做成自托管** —— 凭据始终留在你自己的部署环境里。几点提醒：

- **用应用专用密码，而不是登录密码。** Gmail / Outlook / iCloud / Fastmail /
  QQ / 163 都不允许在 SMTP 里使用常规登录密码。请生成一个应用专用密码（有的
  邮箱称为「授权码」）—— SMTP 抽屉里为每家都附了具体获取路径。
- **SMTP 密码默认不持久化** —— 每次会话需要重新输入（其余信息，包括主机/用户名，
  都会存进 `localStorage`）。在你信任的单人机器上，可在 `config.js` 里设
  `persistSmtpPassword: true` 以图方便。
- **后端请走 HTTPS**，并在生产环境把 `CORS_ORIGIN` 设为你的前端确切来源（切勿用
  `*`），这样凭据不会明文传输，也不会被任意站点调用。
- **遵守反垃圾邮件法规。** 只给同意接收的人发信，提供退订 / 回复方式，并注意
  服务商的发送限额。

## 技术栈

纯 HTML、CSS、JavaScript —— 前端**无框架、无构建步骤、无依赖**。整个界面是状态的
纯函数，重渲染对焦点 / 输入法（IME）安全（见 `assets/js/app.js`）。整个项目唯一的
依赖是可选后端里的 `nodemailer`。

## 参与贡献

欢迎提 Issue 和 PR！请先读：

- [CONTRIBUTING.md](CONTRIBUTING.md) —— 开发环境、项目地图、如何新增语言
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) —— 友善相待
- [SECURITY.md](SECURITY.md) —— 私密上报安全问题
- [CHANGELOG.md](CHANGELOG.md) —— 变更记录

提交 PR 前请运行 `npm run check`（校验所有脚本能正确解析）。

## 许可证

[MIT](LICENSE) —— 随意使用，保留版权声明即可。

<sub>界面最初由 Claude 设计。</sub>
