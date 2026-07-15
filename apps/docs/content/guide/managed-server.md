# 统一服务端

带服务端模板把课程作者的 Provider、模型和 API Key 保留在 Node 服务中。浏览器只调用同源生成端点。

::: concept managed-secret title="服务端密钥边界"
课程作者的生产 API Key 只能通过服务端环境变量读取，不得写入 VitePress 配置、客户端环境变量或浏览器 bundle。
:::

## 可信课程清单

服务启动时会使用 `compileCourseDirectory` 从服务端磁盘上的 `course.config.ts` 和 `content/**/*.md` 编译可信 manifest。浏览器不会向统一服务端上传正文、生成提示或概念，只发送课程 ID、生成位置 ID、作者定义哈希、学习者偏好和追问。

服务端根据 ID 从 manifest 重建 `GenerationInput`。旧的完整 input 请求会被拒绝；静态页面与服务端课程版本不一致时返回 `409`，学习者刷新页面后才能重试。因此应当在同一次部署中发布静态站点和对应生成服务。

BYOK 不经过这条路径：学习者启用 BYOK 后，浏览器直接使用当前页面中的课程定义调用个人 Provider。

## 首次配置

`.env`：

```dotenv
OPENAI_API_KEY=your-server-key
```

`gentorial.server.config.ts`：

```ts
const config = {
  provider: 'openai',
  model: 'gpt-5.1',
  apiKeyEnv: 'OPENAI_API_KEY',
  profileRevision: 'prompt-v1:lesson-v1',
  port: 8787,
  cache: {
    directory: '.gentorial/cache',
    ttlMs: 7 * 24 * 60 * 60 * 1000
  }
}
```

完整字段见[服务端配置参考](../reference/server-config.md)。

## 共享缓存

缓存键包含课程定义、章节原文、生成位置、概念锚点、学习者偏好、追问上下文和服务端生成配置身份。输入完全一致的用户可以复用同一结果。

响应头 `X-Gentorial-Cache` 可能为：

- `miss`：调用 Provider，并在完成后写入缓存。
- `hit`：返回已存在的完整生成结果。
- `bypass`：服务端没有启用缓存。

浏览器响应仍使用 `Cache-Control: no-store`；共享缓存由应用服务端管理，不是浏览器或 CDN 缓存。

::: concept cache-profile title="缓存版本身份"
`profileRevision` 必须在 Prompt、生成参数或输出协议变化时更新。Provider、模型与 Base URL 会和该修订值共同形成 generation profile，防止错误复用旧配置生成的结果。
:::

## 资源限制

`createGentorialServer` 默认拒绝超过 256,000 bytes 的请求、200,000 字符的可信输入、单条路径超过 20 次的追问，以及超过 64,000 字符的输出。限制发生在缓存写入之前，且不会裁剪学习路径。可在 `server/index.ts` 中覆盖，并用 Provider 参数独立限制模型输出 token：

```ts
const gentorial = createGentorialServer({
  // provider、manifests、generationProfile 等配置
  providerOptions: { maxOutputTokens: 4096 },
  limits: {
    maxRequestBytes: 256_000,
    maxInputCharacters: 200_000,
    maxFollowUps: 20,
    maxOutputCharacters: 64_000
  }
})
```

字符预算是跨 Provider 的确定性保护，不等同于模型 tokenizer 给出的精确 token 用量。完整路径仍保存在浏览器会话树中；只有实际请求受到预算约束。

## BYOK 覆盖

运行时先判断学习者是否启用 BYOK。启用后直接创建浏览器生成器，不调用统一服务端，因此既不读取也不写入共享缓存。

::: generate managed-flow kind=explanation concepts=managed-secret,cache-profile
用一个简短的请求时序解释首次服务端生成、第二位相同偏好用户命中缓存，以及第三位 BYOK 用户绕过服务端的过程。
:::

## 访问控制

脚手架生成的服务默认只适合本地开发。公开部署前，应在 `createGentorialServer` 中增加 `authorize(request)`，并在应用边缘实施登录校验、限流、配额和监控，避免生成端点成为公开模型代理。
