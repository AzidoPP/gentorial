export { defineCourse } from './course.js'
export type {
  GentorialPlugin,
  PromptExtensionContext,
  PromptFragment,
  TransformContext,
  ValidationContext
} from './plugin.js'
export {
  calloutBlockSchema,
  codeBlockSchema,
  comparisonBlockSchema,
  conceptSpecSchema,
  courseDefinitionSchema,
  courseManifestSchema,
  generatedLessonSchema,
  generateSpecSchema,
  headingBlockSchema,
  lessonBlockSchema,
  listBlockSchema,
  paragraphBlockSchema,
  sourceLocationSchema,
  validationDiagnosticSchema
} from './schemas.js'
export type {
  CalloutBlock,
  CodeBlock,
  ComparisonBlock,
  ConceptSpec,
  CourseDefinition,
  CourseManifest,
  GeneratedLesson,
  GenerateSpec,
  HeadingBlock,
  LessonBlock,
  ListBlock,
  ParagraphBlock,
  SourceLocation,
  ValidationDiagnostic
} from './types.js'
