import type { z } from 'zod'
import type {
  calloutBlockSchema,
  codeBlockSchema,
  comparisonBlockSchema,
  conceptSpecSchema,
  courseDefinitionSchema,
  courseManifestSchema,
  generatedLessonSchema,
  generateOutputSchema,
  generateSpecSchema,
  generateTriggerSchema,
  headingBlockSchema,
  learnerProfileSchema,
  lessonConversationTurnSchema,
  lessonBlockSchema,
  listBlockSchema,
  paragraphBlockSchema,
  sectionScopeSchema,
  sourceLocationSchema,
  validationDiagnosticSchema
} from './schemas.js'

export type SourceLocation = z.infer<typeof sourceLocationSchema>
export type ValidationDiagnostic = z.infer<typeof validationDiagnosticSchema>
export type CourseDefinition = z.infer<typeof courseDefinitionSchema>
export type CourseManifest = z.infer<typeof courseManifestSchema>
export type ConceptSpec = z.infer<typeof conceptSpecSchema>
export type LearnerProfile = z.infer<typeof learnerProfileSchema>
export type SectionScope = z.infer<typeof sectionScopeSchema>
export type GenerateTrigger = z.infer<typeof generateTriggerSchema>
export type GenerateOutput = z.infer<typeof generateOutputSchema>
export type GenerateSpec = z.infer<typeof generateSpecSchema>
export type ParagraphBlock = z.infer<typeof paragraphBlockSchema>
export type HeadingBlock = z.infer<typeof headingBlockSchema>
export type ListBlock = z.infer<typeof listBlockSchema>
export type CodeBlock = z.infer<typeof codeBlockSchema>
export type CalloutBlock = z.infer<typeof calloutBlockSchema>
export type ComparisonBlock = z.infer<typeof comparisonBlockSchema>
export type LessonBlock = z.infer<typeof lessonBlockSchema>
export type GeneratedLesson = z.infer<typeof generatedLessonSchema>
export type LessonConversationTurn = z.infer<typeof lessonConversationTurnSchema>
