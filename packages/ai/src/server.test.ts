import { defineCourse, type ConceptSpec, type GeneratedLesson, type GenerateSpec } from '@gentorial/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createGentorialGenerationHandler,
  createGentorialServerGenerator,
  type GenerationInput,
  type Generator
} from './index.js'

const source = { file: 'content/index.md', line: 1 }
const concept: ConceptSpec = {
  id: 'switch-discrete',
  statement: 'switch 根据离散结果选择分支。',
  source
}
const generate: GenerateSpec = {
  id: 'switch-range',
  kind: 'example',
  prompt: '说明 switch 不适合连续范围。',
  concepts: [concept.id],
  scope: {
    type: 'section',
    id: 'section-switch',
    heading: 'switch 的适用边界',
    level: 2,
    markdown: '`switch` 根据离散结果选择分支。',
    source
  },
  trigger: { type: 'heading', source },
  output: { placement: 'after-source', mode: 'replace' },
  source
}
const input: GenerationInput = {
  course: defineCourse({
    schemaVersion: '1',
    id: 'c-language',
    title: 'C 语言教程',
    lang: 'zh-CN',
    contentDir: 'content',
    generation: { mode: 'hybrid', defaultLocale: 'zh-CN' },
    accuracy: { policies: [] }
  }),
  generate,
  concepts: [concept]
}
const lesson: GeneratedLesson = {
  schemaVersion: '1',
  markdown: '## 离散分支\n\n使用 `switch`。',
  blocks: [{ type: 'paragraph', text: '使用 switch。' }],
  grounding: { conceptIds: [concept.id], sourceIds: [generate.scope.id] }
}

function handlerFetch(handler: (request: Request) => Promise<Response>): typeof fetch {
  return async (resource, init) => {
    const url = resource instanceof Request ? resource.url : resource.toString()
    return handler(new Request(url, init))
  }
}

describe('Gentorial server generation adapter', () => {
  it('round-trips a structured lesson and request headers through a Web handler', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const handler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      authorize: (request) => request.headers.get('authorization') === 'Bearer test-session'
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler),
      headers: async () => ({ authorization: 'Bearer test-session' })
    })

    await expect(client.generate(input)).resolves.toEqual(lesson)
    expect(generateLesson).toHaveBeenCalledWith(input, { signal: expect.any(AbortSignal) })
  })

  it('streams Markdown deltas end to end over SSE', async () => {
    const generator: Generator = {
      async generate() {
        return lesson
      },
      async *stream() {
        yield '## 标题\n\n'
        yield '- 第一项\n'
        yield '- 第二项'
      }
    }
    const handler = createGentorialGenerationHandler({ generator })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    const chunks: string[] = []
    for await (const chunk of client.stream!(input)) chunks.push(chunk)

    expect(chunks).toEqual(['## 标题\n\n', '- 第一项\n', '- 第二项'])
  })

  it('falls back to lesson Markdown when the server generator is not stream-capable', async () => {
    const handler = createGentorialGenerationHandler({
      generator: { generate: async () => lesson }
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    const chunks: string[] = []
    for await (const chunk of client.stream!(input)) chunks.push(chunk)

    expect(chunks).toEqual([lesson.markdown])
  })

  it('rejects unauthorized requests before invoking the generator', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const handler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      authorize: () => false
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    await expect(client.generate(input)).rejects.toThrow('Unauthorized')
    expect(generateLesson).not.toHaveBeenCalled()
  })

  it('aborts server generation when the response reader is cancelled', async () => {
    let generationSignal: AbortSignal | undefined
    const generator: Generator = {
      async generate() {
        return lesson
      },
      async *stream(_input, context) {
        generationSignal = context?.signal
        yield 'partial'
        await new Promise<void>((resolve) => {
          context?.signal?.addEventListener('abort', () => resolve(), { once: true })
        })
      }
    }
    const handler = createGentorialGenerationHandler({ generator })
    const response = await handler(new Request('https://tutorial.example/api/generate', {
      method: 'POST',
      body: JSON.stringify({ mode: 'stream', input }),
      headers: { 'content-type': 'application/json' }
    }))
    const reader = response.body!.getReader()

    await reader.read()
    await reader.cancel('reader closed')

    expect(generationSignal?.aborted).toBe(true)
  })

  it('transmits provider errors through the SSE stream', async () => {
    const generator: Generator = {
      async generate() {
        return lesson
      },
      async *stream() {
        yield 'partial'
        throw new Error('provider unavailable')
      }
    }
    const handler = createGentorialGenerationHandler({ generator })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    const consume = async () => {
      for await (const _chunk of client.stream!(input)) {
        // Consume until the server sends its terminal error event.
      }
    }
    await expect(consume()).rejects.toThrow('provider unavailable')
  })
})
