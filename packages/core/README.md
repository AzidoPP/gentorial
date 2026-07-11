# `@gentorial/core`

Gentorial 的框架无关协议层，包含课程定义、概念与生成指令、受控课程块、诊断和插件接口。

该包可同时在 Node.js 与浏览器中使用。它不会访问文件系统、发起网络请求，也不依赖 Vue、VitePress 或任何模型 SDK。

```ts
import { defineCourse } from '@gentorial/core'

export default defineCourse({
  schemaVersion: '1',
  id: 'c-language',
  title: 'C 语言教程',
  lang: 'zh-CN',
  contentDir: 'content',
  generation: {
    mode: 'hybrid',
    defaultLocale: 'zh-CN'
  },
  accuracy: {
    standards: ['ISO C17'],
    policies: ['概念锚点的结论不可被反转']
  }
})
```
