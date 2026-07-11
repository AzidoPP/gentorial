import type {
  ConceptSpec,
  GeneratedLesson,
  GenerateSpec
} from '@gentorial/core'
import type { App, InjectionKey, Plugin } from 'vue'

export type RuntimeGenerationRequest = {
  generate: GenerateSpec
  concepts: ConceptSpec[]
  learner?: Record<string, unknown>
}

export type RuntimeGenerationContext = {
  signal: AbortSignal
}

export type GentorialRuntimeOptions = {
  generate(
    request: RuntimeGenerationRequest,
    context: RuntimeGenerationContext
  ): Promise<GeneratedLesson>
}

export type GentorialRuntime = Plugin & GentorialRuntimeOptions

export const gentorialRuntimeKey: InjectionKey<GentorialRuntime> = Symbol('gentorial-runtime')

export function createGentorialRuntime(options: GentorialRuntimeOptions): GentorialRuntime {
  return {
    generate: options.generate,
    install(app: App) {
      app.provide(gentorialRuntimeKey, this)
    }
  }
}
