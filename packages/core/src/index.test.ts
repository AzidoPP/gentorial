import { describe, expect, it } from 'vitest'
import {
  defineCourse,
  generatedLessonSchema,
  generateSpecSchema,
  learnerProfileSchema,
  lessonConversationTurnSchema,
  sectionScopeSchema
} from './index.js'

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
      markdown: '一个包含 **重点** 的讲解。',
      blocks: [{ type: 'paragraph', text: '一个经过约束的讲解。' }],
      grounding: { conceptIds: ['switch-discrete'], sourceIds: ['section-switch'] }
    })

    expect(result.blocks).toHaveLength(1)
    expect(result.markdown).toContain('**重点**')
  })

  it('rejects executable or protocol-external output', () => {
    const result = generatedLessonSchema.safeParse({
      schemaVersion: '1',
      blocks: [{ type: 'html', html: '<script>alert(1)</script>' }],
      grounding: { conceptIds: ['switch-discrete'], sourceIds: ['section-switch'] }
    })

    expect(result.success).toBe(false)
  })
})

describe('lessonConversationTurnSchema', () => {
  const lesson = {
    schemaVersion: '1' as const,
    blocks: [{ type: 'paragraph' as const, text: '一个经过约束的讲解。' }],
    grounding: { conceptIds: ['switch-discrete'], sourceIds: ['section-switch'] }
  }

  it('accepts user questions and structured assistant lessons', () => {
    expect(
      lessonConversationTurnSchema.parse({ role: 'user', content: '为什么不能使用连续范围？' })
    ).toMatchObject({ role: 'user' })
    expect(lessonConversationTurnSchema.parse({ role: 'assistant', lesson })).toMatchObject({
      role: 'assistant',
      lesson
    })
  })

  it('rejects blank user questions', () => {
    expect(lessonConversationTurnSchema.safeParse({ role: 'user', content: '   ' }).success).toBe(
      false
    )
  })
})

describe('learnerProfileSchema', () => {
  it('accepts structured learner preferences', () => {
    const profile = learnerProfileSchema.parse({
      locale: 'zh-CN',
      background: '第一次学习系统编程',
      goal: '理解 C 的语言设计',
      detail: 'deep',
      tone: 'conversational',
      narrative: 'timeline',
      examplePreferences: ['短小的可运行示例']
    })

    expect(profile.narrative).toBe('timeline')
  })

  it('rejects blank strings and empty preference lists', () => {
    expect(learnerProfileSchema.safeParse({ goal: '  ' }).success).toBe(false)
    expect(learnerProfileSchema.safeParse({ examplePreferences: [] }).success).toBe(false)
  })
})

describe('section-scoped generation schemas', () => {
  const source = { file: 'content/index.md', line: 3 }
  const scope = {
    type: 'section' as const,
    id: 'section-c-history',
    heading: 'C 的历史',
    level: 2,
    markdown: '1. ALGOL\n2. B\n3. C',
    source
  }

  it('accepts a stable section scope', () => {
    expect(sectionScopeSchema.parse(scope).id).toBe('section-c-history')
  })

  it('allows generation without concept anchors', () => {
    const generate = generateSpecSchema.parse({
      id: 'c-history',
      kind: 'explanation',
      prompt: '沿语言演化链解释 C 的形成。',
      concepts: [],
      scope,
      trigger: { type: 'heading', source },
      output: { placement: 'after-source', mode: 'replace' },
      source: { file: 'content/index.md', line: 8 }
    })

    expect(generate.concepts).toEqual([])
    expect(generate.output.placement).toBe('after-source')
  })
})
