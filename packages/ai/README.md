# `@gentorial/ai`

Gentorial 的提供方无关 AI 管线。该包负责编译提示、分离提供方适配与传输，并提供确定性 mock。

```ts
import { createMockGenerator } from '@gentorial/ai'

const generator = createMockGenerator()
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
