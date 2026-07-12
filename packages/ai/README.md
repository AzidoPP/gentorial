# `@gentorial/ai`

Gentorial 的提供方无关 AI 管线。该包负责编译提示、分离提供方适配与传输、验证结构化结果，并提供阶段 1 使用的确定性 mock。

```ts
import { createMockGenerator } from '@gentorial/ai'

const generator = createMockGenerator()
const lesson = await generator.generate(input)
```

具体模型 SDK 不进入该包的核心路径；提供方格式由 `ProviderAdapter` 处理，请求去向由 `AITransport` 处理。管线会分别校验不可反转的概念 grounding 与章节范围 grounding，学习者的详略、语气和叙事选择只能改变表达方式。

将 `LessonConversationTurn[]` 放入 `GenerationInput.conversation` 即可围绕已有结果继续提问。每次后续回答仍继承原任务的章节范围、概念锚点和课程准确性策略，并返回完整的 `GeneratedLesson`；不能通过对话绕过 source 或 concept grounding 校验。
