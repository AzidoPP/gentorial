# `@gentorial/engine-vitepress`

Gentorial 的 VitePress 引擎桥接。它组合 VitePress 配置并安装 `concept`、`generate` Markdown 容器规则；课程协议与 AI 请求不在此包中定义。

```ts
import { defineGentorialConfig } from '@gentorial/engine-vitepress'

export default defineGentorialConfig({
  title: 'My course',
  srcDir: '../content'
})
```
