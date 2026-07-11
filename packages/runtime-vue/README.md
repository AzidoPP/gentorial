# `@gentorial/runtime-vue`

Gentorial 的 Vue 3 运行时。它接收统一的 `generate(request)` 函数，管理生成区块的请求、取消、重试与回退，并把受控课程块映射为 Vue 节点。

运行时不会导入模型提供方 SDK，也不会通过 `v-html` 渲染模型输出。

```ts
import { createGentorialRuntime } from '@gentorial/runtime-vue'

app.use(createGentorialRuntime({
  generate: async (request, context) => generator.generate(request, context)
}))
```
