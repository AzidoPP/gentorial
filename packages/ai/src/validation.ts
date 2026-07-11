import {
  generatedLessonSchema,
  type GeneratedLesson,
  type ValidationDiagnostic
} from '@gentorial/core'
import type { GenerationInput, GenerationValidationResult } from './types.js'

export class GenerationValidationError extends Error {
  readonly diagnostics: ValidationDiagnostic[]

  constructor(diagnostics: ValidationDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join('; '))
    this.name = 'GenerationValidationError'
    this.diagnostics = diagnostics
  }
}

export function validateGeneratedLesson(
  value: unknown,
  input: GenerationInput
): GenerationValidationResult {
  const parsed = generatedLessonSchema.safeParse(value)
  if (!parsed.success) {
    return {
      success: false,
      diagnostics: parsed.error.issues.map((issue) => ({
        severity: 'error' as const,
        code: 'AI_INVALID_PROTOCOL',
        message: issue.message,
        path: issue.path.map((part) => (typeof part === 'symbol' ? part.description ?? '' : part))
      }))
    }
  }

  const diagnostics: ValidationDiagnostic[] = []
  const requiredIds = new Set(input.generate.concepts)
  const availableIds = new Set(input.concepts.map((concept) => concept.id))
  const groundedIds = new Set(parsed.data.grounding.conceptIds)

  for (const id of requiredIds) {
    if (!groundedIds.has(id)) {
      diagnostics.push({
        severity: 'error',
        code: 'AI_MISSING_GROUNDING',
        message: `生成结果没有声明必需概念 ${id}`
      })
    }
  }

  for (const id of groundedIds) {
    if (!availableIds.has(id)) {
      diagnostics.push({
        severity: 'error',
        code: 'AI_UNKNOWN_GROUNDING',
        message: `生成结果引用了课程输入中不存在的概念 ${id}`
      })
    }
  }

  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : { success: true, lesson: parsed.data, diagnostics: [] }
}

export function assertGeneratedLesson(value: unknown, input: GenerationInput): GeneratedLesson {
  const result = validateGeneratedLesson(value, input)
  if (!result.success) throw new GenerationValidationError(result.diagnostics)
  return result.lesson
}
