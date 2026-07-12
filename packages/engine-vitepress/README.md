# `@gentorial/engine-vitepress`

Gentorial 的 VitePress 引擎桥接。它组合 VitePress 配置，安装 `concept`、`generate` Markdown 容器规则，把低干扰生成按钮挂载到对应标题，并将输出区域保留在作者原文之后；课程协议与 AI 请求不在此包中定义。

```ts
import { defineGentorialConfig } from '@gentorial/engine-vitepress'

export default defineGentorialConfig({
  title: 'My course',
  srcDir: '../content'
})
```
