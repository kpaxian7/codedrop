<div align="center">

# › codedrop

**用自己的 SMTP,一键群发兑换码。**

把每个收件人对应一个一次性兑换码,写一份带 `{{code}}` 占位符的模板,从自己的邮箱整批发出。零构建、无 SaaS、可自托管——一个静态页 + 可选的百行后端。

[![在线 Demo](https://img.shields.io/badge/demo-live-1c7a4d.svg)](https://kpaxian7.github.io/codedrop/)
[![CI](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml/badge.svg)](https://github.com/kpaxian7/codedrop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)

**🔗 [在线 Demo](https://kpaxian7.github.io/codedrop/)** —— 运行在演示模式(不会真正发信)。

中文 · [English](README.en.md)

</div>

---

## 它能做什么

- **模板 + 占位符**:邮件只写一次,`{{code}}` 按收件人替换,边写边预览。
- **收件人表**:粘贴/输入邮箱与兑换码,每行显示状态(就绪 / 缺码 / 无效 / 空 / 已发);支持 Base64 邮箱自动解码与批量导入。
- **自带 SMTP**:Gmail / Outlook / Fastmail / iCloud / QQ / 163 预设,附各家「应用专用密码」指引。
- **中英双语 + 本地持久化**:一键切换语言;模板、收件人、SMTP 设置存在浏览器本地,刷新不丢。

## 部署

它是个静态站点,分两种用法:

**① 仅演示(不会真正发信)** —— 当静态站点托管即可:

```bash
git clone https://github.com/kpaxian7/codedrop.git
cd codedrop && python3 -m http.server 5173   # 或丢到任意静态托管
```

打开 `http://localhost:5173` 试用。

**② 真实发送** —— 浏览器不能直连 SMTP,所以跑一下自带后端(它会同时托管页面,**一条命令、无需改配置**):

```bash
cd examples/server && npm install && npm start   # 打开它打印的地址
```

前端探测到后端后会**自动切换到真实发送**;没有后端的静态托管则安全地停在演示模式。想前后端分开部署,就在 `assets/js/config.js` 里显式填 `api.endpoint` 覆盖自动探测。

## 配置

改 `assets/js/config.js`(品牌、配色、SMTP 预设、`api.endpoint`);所有文案与默认邮件模板在 `assets/js/i18n.js`。改完刷新即可,无需构建。

## 安全

用**应用专用密码**(不是登录密码);SMTP 密码默认不持久化,每次重新输入;生产环境后端务必走 HTTPS 并设 `CORS_ORIGIN`。细节见[后端 README](examples/server/README.md)。

## License

[MIT](LICENSE)

<sub>UI 最初由 Claude 设计。</sub>
