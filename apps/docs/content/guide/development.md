# 开发与测试

本页面向 Gentorial 仓库贡献者。教程作者创建课程时只需要阅读[快速开始](./getting-started.md)。

## 环境

- Node.js `>=22.13.0`
- pnpm `11.1.2`

```bash
git clone https://github.com/Minsecrus/gentorial.git
cd gentorial
pnpm install --frozen-lockfile
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动最小 VitePress 示例 |
| `pnpm dev:website` | 启动官网 |
| `pnpm dev:docs` | 启动技术文档站 |
| `pnpm build` | 构建全部公开包、示例和应用 |
| `pnpm typecheck` | 检查全部 workspace TypeScript 项目 |
| `pnpm test` | 运行 Vitest 单元与组件测试 |
| `pnpm test:e2e` | 使用 Playwright/Chromium 运行浏览器端到端测试 |
| `pnpm check` | 依次执行构建、类型检查和 Vitest |

首次运行端到端测试前安装 Chromium：

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

端到端测试驱动真实的最小示例页面，通过界面配置 BYOK，并在浏览器网络边界拦截 Provider SSE 响应。测试凭据不会发送到外部服务。

## 测试分层

- 协议、解析器和状态逻辑使用 Vitest 单元测试。
- Vue 组件行为使用组件级渲染测试。
- 页面加载、BYOK、流式生成、追问和失败行为使用 Playwright。
- npm 发布内容使用各包的 `pack:check` dry-run 检查。

修改浏览器交互时，应同时考虑成功、取消、失败和作者原文保留路径。修改脚手架或包导出时，应检查实际 tarball，而不只依赖 workspace 软链接。

## CI

主 CI 在 Windows、Ubuntu 和 Node.js 22.13、24 上执行 `pnpm check` 与包 dry-run。独立的 Ubuntu/Chromium job 执行 Playwright，失败时可使用 Playwright trace 定位页面和网络状态。

## 提交前检查

```bash
pnpm check
pnpm test:e2e
pnpm -r --filter "./packages/*" run pack:check
```

只修改文档时，至少运行技术文档构建：

```bash
pnpm build:docs
```
