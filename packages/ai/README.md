# `@gentorial/ai`

Gentorial 的提供方无关 AI 管线。该包负责编译提示、分离提供方适配与传输，并提供浏览器 BYOK 与服务端生成适配器。

```ts
import { createBrowserByokGenerator } from '@gentorial/ai'

const generator = createBrowserByokGenerator({
  provider: 'openai',
  apiKey: sessionKey,
  model: 'gpt-5.1'
}, { maxOutputTokens: 4096 })
const lesson = await generator.generate(input)
```

具体模型 SDK 不进入该包的核心路径；提供方格式由 `ProviderAdapter` 处理，请求去向由 `AITransport` 处理。概念、章节范围和学习者偏好会进入提示，但框架不判断生成内容是否正确，也不提供内容校验钩子。

将 `LessonConversationTurn[]` 放入 `GenerationInput.conversation` 即可围绕已有结果继续提问。每次后续回答都会收到原任务的章节范围、概念锚点和课程准确性策略。

默认包还提供 `createBrowserByokGenerator`，支持 OpenAI、Anthropic、Google 和 OpenAI-compatible REST 端点。每个提供方都可以覆盖 `model` 与 `baseUrl`；适配器会在 Base URL 后自动补齐对应的请求路径。旧的完整 `endpoint` 参数暂时保留兼容。

```ts
const generator = createBrowserByokGenerator({
  provider: 'custom',
  apiKey: sessionKey,
  model: 'local-model',
  baseUrl: 'https://example.com/v1'
})
```

生成器只接收调用方当前内存中的密钥。`generate()` 返回结构化结果；`stream()` 使用提供方的 SSE 接口逐步返回标准 Markdown。生成提示不允许 HTML、脚本或作者自定义容器。浏览器直连适合学习者明确启用的 BYOK；课程作者的生产密钥应继续放在服务端或本地中继。

## 服务端生成

`createGentorialGenerationHandler` 把任意 `Generator` 暴露为基于 Web Standards `Request` / `Response` 的服务端端点。普通生成返回 JSON `GeneratedLesson`，流式生成返回统一的 SSE Markdown 事件；handler 不绑定 Express、Hono、Bun、Deno 或特定托管平台。

```ts
import { createGentorialGenerationHandler } from '@gentorial/ai'

const handleGeneration = createGentorialGenerationHandler({
  generator: providerGenerator,
  manifests: courseManifest,
  authorize(request) {
    return request.headers.get('authorization') === `Bearer ${process.env.GENTORIAL_TOKEN}`
  }
})

// 在 Web Standard server、worker 或框架路由中：
const response = await handleGeneration(request)
```

教程客户端只需要指向该端点，密钥和提供方配置不会进入浏览器：

```ts
import { createGentorialServerGenerator } from '@gentorial/ai'

const generator = createGentorialServerGenerator({
  endpoint: '/api/gentorial/generate',
  headers: () => ({ authorization: `Bearer ${currentSessionToken}` })
})
```

客户端和 handler 会自动协商 JSON 或 SSE。取消浏览器读取会中止服务端 generator；服务端错误只返回错误消息，不返回堆栈。`authorize` 仅负责端点访问控制，不检查或评价生成内容。

托管请求不会上传完整 `GenerationInput`。客户端只发送课程 ID、生成位置 ID、作者定义哈希、学习者偏好和追问；handler 从可信 `manifests` 中取得正文、提示词与概念并重建输入。完整 input 旧协议直接返回 `400`，页面与服务端定义不一致返回 `409`。

handler 默认在调用模型和读取缓存前限制原始请求大小、可信输入字符数和追问次数，并同时限制普通与流式输出字符数。可通过 `limits` 覆盖，或设为 `false` 关闭。`createProviderGenerator` / `createBrowserByokGenerator` 的 `maxOutputTokens` 会转换成各提供方对应参数；字符预算保持确定性，不作为精确 token 用量展示。

### 服务端统一配置与共享生成缓存

服务端应通过 `createProviderGenerator` 读取环境变量中的统一密钥，并在 handler 上配置共享缓存。缓存键会对完整 `GenerationInput` 做稳定序列化和 SHA-256：课程内容、生成区域、概念锚点、学习者偏好和追问上下文任一变化都会产生新条目。`namespace` 用来标识输入之外的服务端生成配置，必须覆盖提供方、模型、生成参数、提示版本和输出协议版本，但不要放入原始 API Key。

```ts
import {
  createGentorialGenerationHandler,
  createMemoryGenerationCache,
  createProviderGenerator
} from '@gentorial/ai'

const provider = createProviderGenerator({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-5.6-terra'
})

const handleGeneration = createGentorialGenerationHandler({
  generator: provider,
  manifests: courseManifest,
  cache: {
    namespace: 'openai:gpt-5.6-terra:temperature-default:prompt-v1:lesson-v1',
    store: createMemoryGenerationCache({
      maxEntries: 10_000,
      ttlMs: 7 * 24 * 60 * 60 * 1_000
    })
  }
})
```

内存实现适合单进程或开发环境。生产环境可实现相同的 `GentorialGenerationCacheStore` 接口接入 Redis、KV 或数据库；存储值是 `GeneratedLesson`，而不是最终 HTML。缓存读写失败时 handler 会继续调用模型，`onError` 可接入日志和监控。

客户端必须在运行时边界选择生成器。没有 BYOK 时调用服务端，因而读取和写入共享缓存；学习者启用 BYOK 后直接使用其个人提供方，完全绕过服务端端点和共享缓存：

```ts
const managed = createGentorialServerGenerator({
  endpoint: '/api/gentorial/generate'
})

generate(request, context) {
  const input = toGenerationInput(request)
  const active = context.byok
    ? createBrowserByokGenerator({ ...context.byok, provider: context.byok.provider as BrowserByokProvider })
    : managed

  return active.stream?.(input, { signal: context.signal })
    ?? active.generate(input, { signal: context.signal })
}
```

响应仍带有 `Cache-Control: no-store`，以禁止浏览器和中间代理保存个性化结果；服务端应用缓存的命中状态通过 `X-Gentorial-Cache: hit | miss | bypass` 暴露，两者互不冲突。
