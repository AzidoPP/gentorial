# `@gentorial/content`

Gentorial 的内容层。默认入口只解析传入的 Markdown 文本；`@gentorial/content/node` 子入口负责读取课程目录并生成清单。

```ts
import { parseLessonSource } from '@gentorial/content'

const result = parseLessonSource(markdown, { file: 'content/index.md' })
```

解析结果保留文件和行号，并对未闭合指令、无效元信息、重复 ID 与未知概念引用生成面向作者的诊断。该包不包含 VitePress 专属渲染逻辑。
