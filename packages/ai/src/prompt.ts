import type { CompiledPrompt, GenerationInput, PromptCompiler } from './types.js'

function requiredConcepts(input: GenerationInput) {
  const byId = new Map(input.concepts.map((concept) => [concept.id, concept]))
  return input.generate.concepts.map((id) => {
    const concept = byId.get(id)
    if (!concept) {
      throw new Error(`GenerateSpec ${input.generate.id} references missing concept ${id}`)
    }
    return {
      id: concept.id,
      ...(concept.title ? { title: concept.title } : {}),
      statement: concept.statement
    }
  })
}

export function compileGenerationPrompt(input: GenerationInput): CompiledPrompt {
  const payload = {
    protocol: {
      schemaVersion: '1',
      output: 'GeneratedLesson',
      allowedBlocks: ['paragraph', 'heading', 'list', 'code', 'callout', 'comparison'],
      forbidden: ['html', 'script', 'vue-template', 'protocol-external-fields']
    },
    task: {
      id: input.generate.id,
      kind: input.generate.kind,
      prompt: input.generate.prompt
    },
    course: {
      id: input.course.id,
      locale: input.course.generation.defaultLocale,
      policies: input.course.accuracy.policies,
      standards: input.course.accuracy.standards ?? []
    },
    concepts: requiredConcepts(input),
    learner: input.learner ?? null
  }

  return {
    schemaVersion: '1',
    system: [
      '你是 Gentorial 的受约束课程生成器。',
      '概念原文是不可反转的教学事实；学习者偏好只能改变表达方式。',
      '只返回符合 GeneratedLesson 协议的结构化数据，不返回 HTML、脚本或组件代码。',
      'grounding.conceptIds 必须覆盖任务引用的全部概念。'
    ].join('\n'),
    input: JSON.stringify(payload)
  }
}

export const defaultPromptCompiler: PromptCompiler = {
  compile: compileGenerationPrompt
}
