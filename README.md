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

## 如何使用？

```bash
cd examples/server && npm install && npm start

...

CodeDrop is running — open http://localhost:8787
```

## License

[MIT](LICENSE)

<sub>UI 最初由 Claude 设计。</sub>
