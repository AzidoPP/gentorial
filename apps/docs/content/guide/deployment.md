# 生产部署

完整部署包含 VitePress 静态站点和 Node 生成服务两部分。

::: concept deployment-origin title="同源部署"
推荐让教程与 `/api/gentorial/*` 使用同一站点来源，并由反向代理把 API 路径转发到 Node 服务。这样浏览器无需接触课程作者的 Provider Key。
:::

## 构建静态站点

```bash
pnpm build
```

产物位于 `docs/.vitepress/dist`。它可以由任意静态文件服务或 CDN 托管。

## 运行生成服务

部署平台需要支持 Node.js，并设置 `gentorial.server.config.ts#apiKeyEnv` 指定的环境变量：

```bash
pnpm server
```

## 反向代理

将以下路径转发到生成服务：

```text
/api/gentorial/generate
```

生产环境不应依赖 Vite 开发代理。

## 缓存存储

脚手架默认使用文件缓存，适合单实例并且具备持久化磁盘的部署。多实例或无状态平台应实现 `GentorialGenerationCacheStore`，接入 Redis、KV 或数据库。

## 上线检查

- 服务端 Key 只存在于平台环境变量。
- 生成端点已经鉴权、限流并设置配额。
- 已根据模型上下文窗口和成本设置输入、追问、输出与 Provider token 上限。
- `profileRevision` 与当前 Prompt 和输出协议一致。
- 多实例使用共享缓存存储。
- 日志不记录 API Key 或完整敏感输入。
- VitePress 原文在生成服务不可用时仍然可阅读。
- 静态站点与生成服务使用同一版本的课程内容；定义哈希不一致时服务端返回 `409`。

::: generate deployment-review kind=exercise concepts=deployment-origin
根据本页原文生成一份生产部署审查题，重点检查密钥边界、反向代理、访问控制和多实例缓存。
:::
