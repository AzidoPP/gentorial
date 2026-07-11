import { describe, expect, it } from 'vitest'
import { defineCourse, type ConceptSpec, type GenerateSpec } from '@gentorial/core'
import {
  compileGenerationPrompt,
  createMockGenerator,
  GenerationValidationError,
  type GenerationInput
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
  source: { file: 'content/index.md', line: 5 }
}

const input: GenerationInput = {
  course,
  concepts: [concept],
  generate,
  learner: { goal: '准备考试' }
}

describe('compileGenerationPrompt', () => {
  it('includes policies, concepts and learner preferences', () => {
    const prompt = compileGenerationPrompt(input)

    expect(prompt.input).toContain('概念锚点不可被反转')
    expect(prompt.input).toContain('switch-discrete')
    expect(prompt.input).toContain('准备考试')
  })
})

describe('createMockGenerator', () => {
  it('returns deterministic, validated lesson blocks', async () => {
    const lesson = await createMockGenerator().generate(input)

    expect(lesson.grounding.conceptIds).toEqual(['switch-discrete'])
    expect(lesson.blocks[0]).toMatchObject({ type: 'callout', tone: 'info' })
  })

  it('rejects deliberately invalid mock output', async () => {
    const generator = createMockGenerator({
      transform: () => ({ schemaVersion: '1', blocks: [{ type: 'html' }] })
    })

    await expect(generator.generate(input)).rejects.toBeInstanceOf(GenerationValidationError)
  })
})
