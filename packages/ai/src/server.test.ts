import {
  defineCourse,
  type ConceptSpec,
  type CourseManifest,
  type GeneratedLesson,
  type GenerateSpec
} from '@gentorial/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createGentorialGenerationHandler,
  createGentorialGenerationDefinitionHash,
  createMemoryGenerationCache,
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
const manifest: CourseManifest = {
  schemaVersion: '1',
  course: input.course,
  concepts: input.concepts,
  generates: [input.generate],
  contentHash: 'test-content-hash'
}

async function requestBody(
  mode: 'generate' | 'stream',
  generationInput: GenerationInput = input
) {
  return {
    schemaVersion: '1' as const,
    mode,
    courseId: generationInput.course.id,
    generateId: generationInput.generate.id,
    definitionHash: await createGentorialGenerationDefinitionHash(generationInput),
    ...(generationInput.learner ? { learner: generationInput.learner } : {}),
    ...(generationInput.conversation ? { conversation: generationInput.conversation } : {})
  }
}

function handlerFetch(handler: (request: Request) => Promise<Response>): typeof fetch {
  return async (resource, init) => {
    const url = resource instanceof Request ? resource.url : resource.toString()
    return handler(new Request(url, init))
  }
}

describe('Gentorial server generation adapter', () => {
  it('hashes author definitions independently of build-time source paths', async () => {
    const relocated: GenerationInput = {
      ...input,
      generate: {
        ...input.generate,
        source: { ...source, file: 'index.md', line: 20 },
        scope: {
          ...input.generate.scope,
          source: { ...source, file: 'index.md', line: 12 }
        },
        trigger: {
          ...input.generate.trigger,
          source: { ...source, file: 'index.md', line: 12 }
        }
      },
      concepts: input.concepts.map((item) => ({
        ...item,
        source: { ...item.source, file: 'index.md', line: 9 }
      }))
    }

    await expect(createGentorialGenerationDefinitionHash(relocated)).resolves.toBe(
      await createGentorialGenerationDefinitionHash(input)
    )
  })

  it('round-trips a structured lesson and request headers through a Web handler', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const handler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      authorize: (request) => request.headers.get('authorization') === 'Bearer test-session'
    })
    let postedBody: Record<string, unknown> | undefined
    const fetch = handlerFetch(handler)
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: async (resource, init) => {
        postedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        return fetch(resource, init)
      },
      headers: async () => ({ authorization: 'Bearer test-session' })
    })

    await expect(client.generate(input)).resolves.toEqual(lesson)
    expect(postedBody).toMatchObject({
      schemaVersion: '1',
      mode: 'generate',
      courseId: input.course.id,
      generateId: input.generate.id,
      definitionHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u)
    })
    expect(postedBody).not.toHaveProperty('input')
    expect(JSON.stringify(postedBody)).not.toContain(input.generate.prompt)
    expect(JSON.stringify(postedBody)).not.toContain(input.generate.scope.markdown)
    expect(generateLesson).toHaveBeenCalledWith(input, { signal: expect.any(AbortSignal) })
  })

  it('rejects legacy full inputs and mismatched author definitions', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const handler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest
    })
    const legacy = await handler(new Request('https://tutorial.example/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'generate', input })
    }))
    const mismatch = await handler(new Request('https://tutorial.example/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(await requestBody('generate')),
        definitionHash: `sha256:${'0'.repeat(64)}`
      })
    }))

    expect(legacy.status).toBe(400)
    expect(mismatch.status).toBe(409)
    await expect(mismatch.json()).resolves.toMatchObject({
      error: expect.stringContaining('refresh')
    })
    expect(generateLesson).not.toHaveBeenCalled()
  })

  it('enforces request, conversation, input, and output limits before caching', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const limitedConversation: GenerationInput = {
      ...input,
      conversation: [
        { role: 'assistant', lesson },
        { role: 'user', content: 'first' },
        { role: 'assistant', lesson },
        { role: 'user', content: 'second' }
      ]
    }
    const conversationHandler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      limits: { maxFollowUps: 1 }
    })
    const conversationResponse = await conversationHandler(new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify(await requestBody('generate', limitedConversation))
    }))
    expect(conversationResponse.status).toBe(413)
    await expect(conversationResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining('1 follow-ups')
    })

    const requestHandler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      limits: { maxRequestBytes: 10 }
    })
    const requestResponse = await requestHandler(new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify(await requestBody('generate'))
    }))
    expect(requestResponse.status).toBe(413)

    const inputHandler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      limits: { maxInputCharacters: 10 }
    })
    const inputResponse = await inputHandler(new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify(await requestBody('generate'))
    }))
    expect(inputResponse.status).toBe(413)

    const outputHandler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      limits: { maxOutputCharacters: 5 }
    })
    const outputResponse = await outputHandler(new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify(await requestBody('generate'))
    }))
    expect(outputResponse.status).toBe(502)
    expect(generateLesson).toHaveBeenCalledOnce()
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
    const handler = createGentorialGenerationHandler({ generator, manifests: manifest })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    const chunks: string[] = []
    for await (const chunk of client.stream!(input)) chunks.push(chunk)

    expect(chunks).toEqual(['## 标题\n\n', '- 第一项\n', '- 第二项'])
  })

  it('terminates a stream with an error when output exceeds the configured limit', async () => {
    const generator: Generator = {
      async generate() {
        return lesson
      },
      async *stream() {
        yield '1234'
        yield '5678'
      }
    }
    const handler = createGentorialGenerationHandler({
      generator,
      manifests: manifest,
      limits: { maxOutputCharacters: 5 }
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    const consume = async () => {
      for await (const _chunk of client.stream!(input)) {
        // Consume until the server emits its resource-limit error.
      }
    }
    await expect(consume()).rejects.toThrow('exceeds 5 characters')
  })

  it('falls back to lesson Markdown when the server generator is not stream-capable', async () => {
    const handler = createGentorialGenerationHandler({
      generator: { generate: async () => lesson },
      manifests: manifest
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
      manifests: manifest,
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
    const handler = createGentorialGenerationHandler({ generator, manifests: manifest })
    const response = await handler(new Request('https://tutorial.example/api/generate', {
      method: 'POST',
      body: JSON.stringify(await requestBody('stream')),
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
    const handler = createGentorialGenerationHandler({ generator, manifests: manifest })
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

  it('shares server-managed results for identical course input and learner preferences', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const handler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      cache: {
        namespace: 'openai:gpt-test:prompt-v1',
        store: createMemoryGenerationCache()
      }
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    await expect(client.generate(input)).resolves.toEqual(lesson)
    await expect(client.generate(input)).resolves.toEqual(lesson)

    expect(generateLesson).toHaveBeenCalledTimes(1)
  })

  it('separates cache entries when learner preferences differ', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const handler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      cache: {
        namespace: 'openai:gpt-test:prompt-v1',
        store: createMemoryGenerationCache()
      }
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    await client.generate({ ...input, learner: { detail: 'concise', tone: 'formal' } })
    await client.generate({ ...input, learner: { detail: 'deep', tone: 'formal' } })
    await client.generate({ ...input, learner: { detail: 'concise', tone: 'formal' } })

    expect(generateLesson).toHaveBeenCalledTimes(2)
  })

  it('separates shared entries by the complete server generation namespace', async () => {
    const store = createMemoryGenerationCache()
    const firstGenerate = vi.fn(async () => lesson)
    const secondGenerate = vi.fn(async () => lesson)
    const first = createGentorialGenerationHandler({
      generator: { generate: firstGenerate },
      manifests: manifest,
      cache: { namespace: 'openai:gpt-a:prompt-v1', store }
    })
    const second = createGentorialGenerationHandler({
      generator: { generate: secondGenerate },
      manifests: manifest,
      cache: { namespace: 'openai:gpt-b:prompt-v1', store }
    })

    const body = await requestBody('generate')
    const request = () => new Request('https://tutorial.example/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const firstMiss = await first(request())
    const firstHit = await first(request())
    const secondMiss = await second(request())

    expect(firstMiss.headers.get('x-gentorial-cache')).toBe('miss')
    expect(firstHit.headers.get('x-gentorial-cache')).toBe('hit')
    expect(secondMiss.headers.get('x-gentorial-cache')).toBe('miss')
    expect(firstGenerate).toHaveBeenCalledTimes(1)
    expect(secondGenerate).toHaveBeenCalledTimes(1)
  })

  it('stores completed server streams and replays them without another provider call', async () => {
    const stream = vi.fn(async function* () {
      yield '## 标题\n\n'
      yield '缓存内容'
    })
    const handler = createGentorialGenerationHandler({
      generator: { async generate() { return lesson }, stream },
      manifests: manifest,
      cache: {
        namespace: 'openai:gpt-test:prompt-v1',
        store: createMemoryGenerationCache()
      }
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    const first: string[] = []
    for await (const chunk of client.stream!(input)) first.push(chunk)
    const second: string[] = []
    for await (const chunk of client.stream!(input)) second.push(chunk)

    expect(first.join('')).toBe('## 标题\n\n缓存内容')
    expect(second).toEqual(['## 标题\n\n缓存内容'])
    expect(stream).toHaveBeenCalledTimes(1)
  })

  it('fails open when the shared cache store is unavailable', async () => {
    const onError = vi.fn()
    const generateLesson = vi.fn(async () => lesson)
    const handler = createGentorialGenerationHandler({
      generator: { generate: generateLesson },
      manifests: manifest,
      cache: {
        namespace: 'openai:gpt-test:prompt-v1',
        store: {
          get() { throw new Error('cache offline') },
          set() { throw new Error('cache offline') }
        },
        onError
      }
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/generate',
      fetch: handlerFetch(handler)
    })

    await expect(client.generate(input)).resolves.toEqual(lesson)
    expect(generateLesson).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(2)
  })
})
