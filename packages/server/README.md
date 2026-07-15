# `@gentorial/server`

Gentorial 的服务端生成模块。它负责统一 Provider/Model/API Key、共享生成结果缓存和 Web Standards HTTP handler；浏览器端只调用生成端点，无法接触服务端密钥。

```ts
import {
  createFileGenerationCache,
  createGentorialServer
} from '@gentorial/server'
import { compileCourseDirectory } from '@gentorial/content/node'

const { manifest } = await compileCourseDirectory({ rootDir, course })

const gentorial = createGentorialServer({
  manifests: manifest,
  provider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-5.6-terra'
  },
  generationProfile: 'openai:gpt-5.6-terra:temperature-default:prompt-v1:lesson-v1',
  providerOptions: { maxOutputTokens: 4096 },
  limits: {
    maxRequestBytes: 256_000,
    maxInputCharacters: 200_000,
    maxFollowUps: 20,
    maxOutputCharacters: 64_000
  },
  cache: {
    store: createFileGenerationCache({
      directory: '.gentorial/cache',
      ttlMs: 7 * 24 * 60 * 60 * 1_000
    })
  },
  authorize(request) {
    return Boolean(readUserSession(request))
  }
})

// 在任意支持 Web Request/Response 的路由中返回：
return gentorial.handle(request)
```

`generationProfile` 是服务端生成配置的版本化身份，必须覆盖 Provider、Model、会影响输出的参数、Prompt 版本和输出协议版本，但不能包含原始 Key。课程定义、章节内容、概念锚点、学习者偏好和追问上下文会自动进入稳定缓存键。

统一服务端请求只接收课程 ID、生成位置 ID、作者定义哈希、学习者偏好和追问。正文、生成提示和概念不会由浏览器上传；服务端从 `manifests` 重建可信输入，并在页面版本不一致时返回 `409`。旧的完整 `GenerationInput` 请求会被拒绝。BYOK 路径不经过此校验，因为它直接在学习者浏览器中调用个人 Provider。

服务端默认限制请求为 256,000 bytes、可信重建输入为 200,000 字符、单条学习路径为 20 次追问、输出为 64,000 字符；超限输入返回 `413`，超限输出不会写入缓存。`limits` 可覆盖这些值，设为 `false` 可关闭框架限制。`providerOptions.maxOutputTokens` 会直接写入 OpenAI、Anthropic、Google 或兼容提供方请求；字符限制是提供方无关的确定性保护，不冒充精确 token 统计。

默认缓存是单进程内存 LRU/TTL。`createFileGenerationCache` 可在单机进程重启后继续复用；多实例生产部署应实现 `GentorialGenerationCacheStore` 接入 Redis、KV 或数据库。

## BYOK 覆盖

BYOK 不应发送到 `@gentorial/server`。客户端运行时先选择生成器：

```ts
const active = context.byok
  ? createBrowserByokGenerator(context.byok)
  : createGentorialServerGenerator({ endpoint: '/api/gentorial/generate' })
```

因此服务端指定配置享受共享缓存；个人 BYOK 直接调用个人 Provider，既不读取也不写入服务端缓存。
