import type { GeneratedLesson, LessonBlock } from '@gentorial/core'
import { assertGeneratedLesson } from './validation.js'
import type { GenerationInput, Generator } from './types.js'

export type MockGeneratorOptions = {
  transform?: (lesson: GeneratedLesson, input: GenerationInput) => unknown
}

function plainFragment(value: string): string {
  return value
    .replace(/^\s*(?:#{1,6}|[-*+]|\d+\.)\s+/gmu, '')
    .replace(/[`*_~]/gu, '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' → ')
    .replace(/[。；，,.!?！？：:]$/u, '')
}

function narrativeLead(input: GenerationInput): string {
  switch (input.learner?.narrative) {
    case 'story':
      return '从这段脉络出发，'
    case 'timeline':
      return '顺着发展顺序看，'
    case 'comparison':
      return '对照来看，'
    default:
      return ''
  }
}

function expandForDetail(
  base: string,
  grounding: string,
  input: GenerationInput,
  includeGrounding = true
): string {
  if (input.learner?.detail === 'concise') return base

  const grounded = includeGrounding
    ? `${base} 其中最关键的线索是：${grounding}。`
    : base
  if (input.learner?.detail !== 'deep') return grounded

  return `${grounded} 把这些线索逐项对照，可以进一步看清它们之间的联系。`
}

function lessonBlocks(input: GenerationInput): LessonBlock[] {
  const concept = input.concepts.find((item) => item.id === input.generate.concepts[0])
  const source = plainFragment(input.generate.scope.markdown)
  const grounding = concept
    ? plainFragment(concept.statement)
    : source || input.generate.scope.heading
  const lead = narrativeLead(input)
  const conversation = input.conversation ?? []
  const lastTurn = conversation[conversation.length - 1]

  if (lastTurn?.role === 'user') {
    const base = `${lead}对于“${lastTurn.content}”，可以回到“${input.generate.scope.heading}”中的核心线索：${grounding}。`
    return [
      {
        type: 'paragraph',
        text: expandForDetail(base, grounding, input, false)
      }
    ]
  }

  const prompt = input.generate.prompt.trim()
  const base = input.generate.kind === 'example'
    ? /^(?:请|根据|围绕|解释|说明|给出|展示|使用|用)/u.test(prompt)
      ? `${lead}可以从一个具体情境理解这一点：${grounding}。`
      : `${lead}${prompt}`
    : `${lead}${source || grounding}串起了“${input.generate.scope.heading}”的基本脉络。`

  return [
    {
      type: 'paragraph',
      text: expandForDetail(base, grounding, input, input.generate.kind === 'example')
    }
  ]
}

export function createMockGenerator(options: MockGeneratorOptions = {}): Generator {
  return {
    async generate(input) {
      const lesson: GeneratedLesson = {
        schemaVersion: '1',
        blocks: lessonBlocks(input),
        grounding: {
          conceptIds: [...input.generate.concepts],
          sourceIds: [input.generate.scope.id]
        }
      }
      const value = options.transform ? options.transform(lesson, input) : lesson
      return assertGeneratedLesson(value, input)
    }
  }
}
