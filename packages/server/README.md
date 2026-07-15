# `@gentorial/server`

Gentorial 的服务端生成模块。它负责统一 Provider/Model/API Key、共享生成结果缓存和 Web Standards HTTP handler；浏览器端只调用生成端点，无法接触服务端密钥。

```ts
import {
  createFileGenerationCache,
  createGentorialServer
} from '@gentorial/server'

const gentorial = createGentorialServer({
  provider: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-5.6-terra'
  },
  generationProfile: 'openai:gpt-5.6-terra:temperature-default:prompt-v1:lesson-v1',
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

默认缓存是单进程内存 LRU/TTL。`createFileGenerationCache` 可在单机进程重启后继续复用；多实例生产部署应实现 `GentorialGenerationCacheStore` 接入 Redis、KV 或数据库。

## BYOK 覆盖

BYOK 不应发送到 `@gentorial/server`。客户端运行时先选择生成器：

```ts
const active = context.byok
  ? createBrowserByokGenerator(context.byok)
  : createGentorialServerGenerator({ endpoint: '/api/gentorial/generate' })
```

因此服务端指定配置享受共享缓存；个人 BYOK 直接调用个人 Provider，既不读取也不写入服务端缓存。
