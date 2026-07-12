import type {
  ConceptSpec,
  CourseDefinition,
  GeneratedLesson,
  GenerateSpec,
  LearnerProfile,
  LessonConversationTurn,
  ValidationDiagnostic
} from '@gentorial/core'

export type LearnerPreferences = LearnerProfile

export type GenerationInput = {
  course: CourseDefinition
  generate: GenerateSpec
  concepts: ConceptSpec[]
  learner?: LearnerProfile
  conversation?: LessonConversationTurn[]
}

export type CompiledPrompt = {
  schemaVersion: '1'
  system: string
  input: string
}

export type GenerationContext = {
  signal?: AbortSignal
}

export interface Generator {
  generate(input: GenerationInput, context?: GenerationContext): Promise<GeneratedLesson>
}

export interface PromptCompiler {
  compile(input: GenerationInput): CompiledPrompt
}

export interface ProviderAdapter<TRequest, TResponse> {
  id: string
  createRequest(prompt: CompiledPrompt): TRequest
  readStructuredResult(response: TResponse): unknown
}

export type TransportContext = GenerationContext & {
  providerId: string
}

export interface AITransport<TRequest, TResponse> {
  send(request: TRequest, context: TransportContext): Promise<TResponse>
}

export type GenerationPipelineOptions<TRequest, TResponse> = {
  compiler?: PromptCompiler
  adapter: ProviderAdapter<TRequest, TResponse>
  transport: AITransport<TRequest, TResponse>
}

export type GenerationValidationResult =
  | { success: true; lesson: GeneratedLesson; diagnostics: [] }
  | { success: false; diagnostics: ValidationDiagnostic[] }
