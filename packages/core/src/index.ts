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
export type {
  CalloutBlock,
  CodeBlock,
  ComparisonBlock,
  ConceptSpec,
  CourseDefinition,
  CourseManifest,
  GeneratedLesson,
  GenerateOutput,
  GenerateSpec,
  GenerateTrigger,
  HeadingBlock,
  LearnerProfile,
  LessonConversationTurn,
  LessonBlock,
  ListBlock,
  ParagraphBlock,
  SectionScope,
  SourceLocation,
  ValidationDiagnostic
} from './types.js'
