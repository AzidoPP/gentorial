import type {
  ConceptSpec,
  CourseDefinition,
  GeneratedLesson,
  GenerateSpec,
  LessonBlock,
  ValidationDiagnostic
} from './types.js'

export type PromptFragment = {
  role: 'system' | 'user'
  text: string
}

export type PromptExtensionContext = {
  course: CourseDefinition
  generate: GenerateSpec
  concepts: ConceptSpec[]
}

export type ValidationContext = PromptExtensionContext & {
  lesson: GeneratedLesson
}

export type TransformContext = ValidationContext

export interface GentorialPlugin {
  name: string
  version: string
  extendPrompt?(
    context: PromptExtensionContext
  ): PromptFragment[] | Promise<PromptFragment[]>
  validate?(
    context: ValidationContext
  ): ValidationDiagnostic[] | Promise<ValidationDiagnostic[]>
  transformBlocks?(
    context: TransformContext
  ): LessonBlock[] | Promise<LessonBlock[]>
}
