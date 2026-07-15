# __COURSE_TITLE__

由 Gentorial 创建的生成式教程项目。

```bash
__INSTALL_COMMAND__
__DEV_COMMAND__
```

默认页面始终显示作者写明的概念锚点；没有密钥时使用确定性 mock，因此项目可直接启动。导航栏中的偏好按钮会打开 Preferences / BYOK 两步弹窗；学习者可以填写提供方、密钥、模型与 Base URL，随后生成与追问会改用对应的 OpenAI、Anthropic、Google 或 OpenAI-compatible 端点。密钥只保存在当前页面会话内存中。

模板已默认启用 LaTeX 与 Mermaid。在 Markdown 中使用 `$E = mc^2$` 或 `$$...$$` 编写公式，使用 ```` ```mermaid ```` 代码块编写图示，无需额外配置。

`course.config.ts` 中的 `rendering.allowUnsafeHtml` 控制 AI 输出中的原始 HTML。默认关闭；开启后，原始 HTML 会以当前站点的同源权限渲染。
