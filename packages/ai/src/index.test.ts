import { describe, expect, it } from 'vitest'
import { defineCourse, type ConceptSpec, type GenerateSpec } from '@gentorial/core'
import {
  compileGenerationPrompt,
  createMockGenerator,
  GenerationValidationError,
  type GenerationInput,
  validateGeneratedLesson
} from './index.js'

const course = defineCourse({
  schemaVersion: '1',
  id: 'c-language',
  title: 'C 语言教程',
  lang: 'zh-CN',
  contentDir: 'content',
  generation: { mode: 'hybrid', defaultLocale: 'zh-CN' },
  accuracy: {
    policies: ['概念锚点不可被反转'],
    standards: ['ISO C17']
  }
})

const concept: ConceptSpec = {
  id: 'switch-discrete',
  statement: 'switch 根据离散结果选择分支。',
  source: { file: 'content/index.md', line: 1 }
}

const generate: GenerateSpec = {
  id: 'switch-range',
  kind: 'example',
  prompt: '说明 switch 不适合连续范围。',
  concepts: ['switch-discrete'],
  scope: {
    type: 'section',
    id: 'section-switch',
    heading: 'switch 的适用边界',
    level: 2,
    markdown: '`switch` 根据离散结果选择分支。',
    source: { file: 'content/index.md', line: 1 }
  },
  trigger: {
    type: 'heading',
    source: { file: 'content/index.md', line: 1 }
  },
  output: { placement: 'after-source', mode: 'replace' },
  source: { file: 'content/index.md', line: 5 }
}

const input: GenerationInput = {
  course,
  concepts: [concept],
  generate,
  learner: {
    goal: '准备考试',
    detail: 'deep',
    narrative: 'comparison'
  }
}

const previousLesson = {
  schemaVersion: '1' as const,
  blocks: [{ type: 'paragraph' as const, text: 'switch 适合离散分支。' }],
  grounding: {
    conceptIds: ['switch-discrete'],
    sourceIds: ['section-switch']
  }
}

const followUpInput: GenerationInput = {
  ...input,
  conversation: [
    { role: 'assistant', lesson: previousLesson },
    { role: 'user', content: '那连续范围应该怎么写？' }
  ]
}

describe('compileGenerationPrompt', () => {
  it('includes policies, scope, concepts and learner profile', () => {
    const prompt = compileGenerationPrompt(input)

    expect(prompt.input).toContain('概念锚点不可被反转')
    expect(prompt.input).toContain('switch-discrete')
    expect(prompt.input).toContain('section-switch')
    expect(prompt.input).toContain('`switch` 根据离散结果选择分支。')
    expect(prompt.input).toContain('准备考试')
    expect(prompt.input).toContain('comparison')
    expect(prompt.system).toContain('grounding.sourceIds')
  })

  it('includes the lesson conversation and preserves its grounding constraints', () => {
    const prompt = compileGenerationPrompt(followUpInput)
    const payload = JSON.parse(prompt.input) as { conversation: unknown[] }

    expect(payload.conversation).toEqual(followUpInput.conversation)
    expect(prompt.system).toContain('后续问答必须继承当前 scope、概念锚点和课程准确性策略')
    expect(prompt.system).toContain('grounding.sourceIds 与 grounding.conceptIds 的规则保持不变')
    expect(prompt.system).toContain('不得依赖界面重复显示用户问题')
  })
})

describe('createMockGenerator', () => {
  it('returns deterministic, validated lesson blocks', async () => {
    const lesson = await createMockGenerator().generate(input)

    expect(lesson.grounding.conceptIds).toEqual(['switch-discrete'])
    expect(lesson.grounding.sourceIds).toEqual(['section-switch'])
    expect(lesson.blocks[0]).toMatchObject({
      type: 'paragraph',
      text: expect.stringContaining('对照来看，')
    })
    expect(JSON.stringify(lesson)).not.toMatch(/确定性|Mock|叙事=|详略=|依据：/u)
  })

  it('rejects deliberately invalid mock output', async () => {
    const generator = createMockGenerator({
      transform: () => ({ schemaVersion: '1', blocks: [{ type: 'html' }] })
    })

    await expect(generator.generate(input)).rejects.toBeInstanceOf(GenerationValidationError)
  })

  it('supports section-only generation without concepts', async () => {
    const sectionOnlyInput: GenerationInput = {
      ...input,
      concepts: [],
      generate: { ...generate, concepts: [] },
      learner: { detail: 'concise', narrative: 'timeline' }
    }

    const lesson = await createMockGenerator().generate(sectionOnlyInput)

    expect(lesson.grounding.conceptIds).toEqual([])
    expect(lesson.grounding.sourceIds).toEqual(['section-switch'])
    expect(lesson.blocks[0]).toMatchObject({ text: expect.stringContaining('顺着发展顺序看，') })
  })

  it('returns a deterministic, source-grounded answer to the latest user question', async () => {
    const lesson = await createMockGenerator().generate(followUpInput)

    expect(lesson.blocks[0]).toMatchObject({
      type: 'paragraph',
      text: expect.stringContaining('那连续范围应该怎么写？')
    })
    expect(lesson.blocks[0]).toMatchObject({
      text: expect.stringContaining('“switch 的适用边界”中的核心线索')
    })
    expect(lesson.blocks[0]).toMatchObject({ text: expect.stringContaining('对照来看，') })
    expect(lesson.blocks[0]).toMatchObject({
      text: expect.stringContaining('把这些线索逐项对照')
    })
    expect(JSON.stringify(lesson)).not.toMatch(/确定性|Mock|叙事=|详略=|依据：/u)
    expect(lesson.grounding.conceptIds).toEqual(['switch-discrete'])
    expect(lesson.grounding.sourceIds).toEqual(['section-switch'])
  })
})

describe('validateGeneratedLesson', () => {
  const lesson = {
    schemaVersion: '1' as const,
    blocks: [{ type: 'paragraph' as const, text: '受约束的讲解。' }],
    grounding: {
      conceptIds: ['switch-discrete'],
      sourceIds: ['section-switch']
    }
  }

  it('requires grounding for the current section scope', () => {
    const result = validateGeneratedLesson(
      { ...lesson, grounding: { ...lesson.grounding, sourceIds: [] } },
      input
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'AI_MISSING_SOURCE_GROUNDING' })
      )
    }
  })

  it('rejects grounding for unknown section sources', () => {
    const result = validateGeneratedLesson(
      {
        ...lesson,
        grounding: {
          ...lesson.grounding,
          sourceIds: ['section-switch', 'unknown-section']
        }
      },
      input
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'AI_UNKNOWN_SOURCE_GROUNDING' })
      )
    }
  })
})
