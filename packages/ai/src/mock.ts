import type { GeneratedLesson, LessonBlock } from '@gentorial/core'
import { assertGeneratedLesson } from './validation.js'
import type { GenerationInput, Generator } from './types.js'

export type MockGeneratorOptions = {
  transform?: (lesson: GeneratedLesson, input: GenerationInput) => unknown
}

function lessonBlocks(input: GenerationInput): LessonBlock[] {
  const concept = input.concepts.find((item) => item.id === input.generate.concepts[0])
  const statement = concept?.statement ?? '概念锚点不可用。'

  if (input.generate.kind === 'example') {
    return [
      {
        type: 'callout',
        tone: 'info',
        title: '确定性示例',
        text: input.generate.prompt
      },
      {
        type: 'paragraph',
        text: `这个示例以“${statement}”为依据。`
      }
    ]
  }

  return [
    {
      type: 'paragraph',
      text: `${input.generate.prompt}（依据：${statement}）`
    }
  ]
}

export function createMockGenerator(options: MockGeneratorOptions = {}): Generator {
  return {
    async generate(input) {
      const lesson: GeneratedLesson = {
        schemaVersion: '1',
        title: `Mock：${input.generate.id}`,
        blocks: lessonBlocks(input),
        grounding: {
          conceptIds: [...input.generate.concepts]
        }
      }
      const value = options.transform ? options.transform(lesson, input) : lesson
      return assertGeneratedLesson(value, input)
    }
  }
}
