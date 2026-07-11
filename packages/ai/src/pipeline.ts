import { defaultPromptCompiler } from './prompt.js'
import { assertGeneratedLesson } from './validation.js'
import type {
  GenerationPipelineOptions,
  Generator
} from './types.js'

export function createGenerationPipeline<TRequest, TResponse>(
  options: GenerationPipelineOptions<TRequest, TResponse>
): Generator {
  const compiler = options.compiler ?? defaultPromptCompiler

  return {
    async generate(input, context = {}) {
      const prompt = compiler.compile(input)
      const request = options.adapter.createRequest(prompt)
      const response = await options.transport.send(request, {
        ...context,
        providerId: options.adapter.id
      })
      const value = options.adapter.readStructuredResult(response)
      return assertGeneratedLesson(value, input)
    }
  }
}

export const createRemoteGenerator = createGenerationPipeline
