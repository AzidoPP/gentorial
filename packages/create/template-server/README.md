# __COURSE_TITLE__

由 Gentorial 创建的带服务端生成与共享缓存的教程项目。

## 首次启动

1. 在 `.env` 中填写 `OPENAI_API_KEY`。
2. 如需更换提供方或模型，修改 `gentorial.server.config.ts`。
3. 安装依赖并同时启动教程与生成服务：

```bash
__INSTALL_COMMAND__
__DEV_COMMAND__
```

VitePress 会把 `/api/gentorial/*` 代理到本地生成服务。服务端缺少 API Key 时会立即报错，不会回退到 mock。默认情况下，生成请求使用服务端统一配置并共享缓存；学习者在 Preferences 中启用 BYOK 后会绕过服务端和共享缓存。

服务启动时从本地课程配置和 Markdown 编译可信 manifest。统一服务端请求不上传正文、生成提示或概念；服务端根据课程 ID、生成位置 ID 和定义哈希重建输入。静态页面与服务端课程版本不一致时会要求刷新页面。BYOK 仍直接使用浏览器当前页面中的课程输入。

## 关键配置

集中修改根目录 `gentorial.server.config.ts`：

- `provider`：`openai`、`anthropic`、`google` 或 `custom`。
- `model`：服务端统一使用的模型。
- `baseUrl`：自定义或兼容端点，可选；`custom` 必填。
- `apiKeyEnv`：读取 API Key 的环境变量名，必须与 `.env` 一致。
- `profileRevision`：Prompt、生成参数或输出协议变化时递增，以隔离旧缓存。
- `port`：本地生成服务端口，VitePress 代理会自动跟随。
- `cache.directory`、`cache.ttlMs`：单机持久化缓存位置和有效期。

`course.config.ts` 仍负责课程、语言、生成模式、准确性策略和 `rendering.allowUnsafeHtml`。

## 部署

生产环境将 VitePress 静态文件和 Node 服务部署在同一站点，并把 `/api/gentorial/*` 转发到 Node 服务。文件缓存适合单实例；多实例应把 `server/index.ts` 中的文件缓存替换为 Redis、KV 或数据库实现。

示例服务默认不限制访问，只适合本地开发。公开部署前必须在 `server/index.ts` 的 `createGentorialServer` 配置中增加 `authorize(request)`，并在应用入口配置登录校验、限流和配额。

AI 输出不存在 mock 回退：服务端配置错误、Provider 请求失败或纯前端未配置 BYOK 时，生成区域会显示错误。
