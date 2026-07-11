import { defineCourse } from '@gentorial/core'

export default defineCourse({
  schemaVersion: '1',
  id: 'gentorial-minimal',
  title: 'Gentorial 最小示例',
  description: '用 switch 章节验证概念锚点、生成区块、校验与静态回退。',
  lang: 'zh-CN',
  contentDir: 'content',
  generation: {
    mode: 'hybrid',
    defaultLocale: 'zh-CN'
  },
  accuracy: {
    standards: ['ISO C17'],
    policies: [
      '概念锚点的结论不可被反转',
      '示例代码必须说明适用前提'
    ]
  }
})
