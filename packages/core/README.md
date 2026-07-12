# `@gentorial/core`

Gentorial 的框架无关协议层，包含课程定义、概念锚点、章节范围、学习者偏好、生成指令、受控课程块、诊断和插件接口。

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

一次生成会分别记录作者限定的 `scope`、标题触发器、`after-source` 输出目标和学习者表达偏好。生成结果必须在 `grounding.sourceIds` 中声明对应章节来源；概念锚点仍通过 `grounding.conceptIds` 独立校验。

`LessonConversationTurn` 用于记录结果上的深入问答。学习者消息是非空的 `content`，助手消息始终保存完整、可校验的 `GeneratedLesson`，因此后续回答与初始结果使用同一套安全输出协议。
