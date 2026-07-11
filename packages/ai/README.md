# `@gentorial/ai`

Gentorial 的提供方无关 AI 管线。该包负责编译提示、分离提供方适配与传输、验证结构化结果，并提供阶段 1 使用的确定性 mock。

```ts
import { createMockGenerator } from '@gentorial/ai'

const generator = createMockGenerator()
const lesson = await generator.generate(input)
```

具体模型 SDK 不进入该包的核心路径；提供方格式由 `ProviderAdapter` 处理，请求去向由 `AITransport` 处理。
