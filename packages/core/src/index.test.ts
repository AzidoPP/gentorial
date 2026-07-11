import { describe, expect, it } from 'vitest'
import { defineCourse, generatedLessonSchema } from './index.js'

describe('defineCourse', () => {
  it('validates and preserves a valid course definition', () => {
    const course = defineCourse({
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
        policies: ['概念锚点的结论不可被反转'],
        standards: ['ISO C17']
      }
    })

    expect(course.id).toBe('c-language')
  })
})

describe('generatedLessonSchema', () => {
  it('accepts registered lesson blocks', () => {
    const result = generatedLessonSchema.parse({
      schemaVersion: '1',
      blocks: [{ type: 'paragraph', text: '一个经过约束的讲解。' }],
      grounding: { conceptIds: ['switch-discrete'] }
    })

    expect(result.blocks).toHaveLength(1)
  })

  it('rejects executable or protocol-external output', () => {
    const result = generatedLessonSchema.safeParse({
      schemaVersion: '1',
      blocks: [{ type: 'html', html: '<script>alert(1)</script>' }],
      grounding: { conceptIds: ['switch-discrete'] }
    })

    expect(result.success).toBe(false)
  })
})
