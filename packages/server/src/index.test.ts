import { defineCourse, type ConceptSpec, type GeneratedLesson, type GenerateSpec } from '@gentorial/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createFileGenerationCache,
  createGentorialServer,
  createGentorialServerGenerator,
  type GenerationInput
} from './index.js'

const temporaryDirectories: string[] = []
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ))
})

const source = { file: 'content/index.md', line: 1 }
const concept: ConceptSpec = {
  id: 'server-cache',
  statement: '相同配置和偏好可以复用生成结果。',
  source
}
const generate: GenerateSpec = {
  id: 'server-cache-example',
  kind: 'example',
  prompt: '解释共享缓存。',
  concepts: [concept.id],
  scope: {
    type: 'section',
    id: 'server-cache-section',
    heading: '服务端缓存',
    level: 2,
    markdown: '缓存由服务端管理。',
    source
  },
  trigger: { type: 'heading', source },
  output: { placement: 'after-source', mode: 'replace' },
  source
}
const input: GenerationInput = {
  course: defineCourse({
    schemaVersion: '1',
    id: 'server-course',
    title: '服务端课程',
    lang: 'zh-CN',
    contentDir: 'content',
    generation: { mode: 'hybrid', defaultLocale: 'zh-CN' },
    accuracy: { policies: [] }
  }),
  generate,
  concepts: [concept],
  learner: { detail: 'deep', tone: 'formal' }
}
const lesson: GeneratedLesson = {
  schemaVersion: '1',
  markdown: '服务端生成结果',
  blocks: [{ type: 'paragraph', text: '服务端生成结果' }],
  grounding: { conceptIds: [concept.id], sourceIds: [generate.scope.id] }
}

function handlerFetch(handler: (request: Request) => Promise<Response>): typeof fetch {
  return async (resource, init) => {
    const url = resource instanceof Request ? resource.url : resource.toString()
    return handler(new Request(url, init))
  }
}

describe('@gentorial/server', () => {
  it('owns the provider key and shares identical generated lessons by default', async () => {
    const providerFetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(lesson) } }]
    }), { headers: { 'content-type': 'application/json' } }))
    const server = createGentorialServer({
      provider: {
        provider: 'openai',
        apiKey: 'server-only-secret',
        model: 'server-model',
        baseUrl: 'https://provider.example/v1'
      },
      providerOptions: { fetch: providerFetch as typeof fetch },
      generationProfile: 'openai:server-model:prompt-v1:lesson-v1'
    })
    const client = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/gentorial/generate',
      fetch: handlerFetch(server.handle)
    })

    await expect(client.generate(input)).resolves.toEqual(lesson)
    await expect(client.generate(input)).resolves.toEqual(lesson)

    expect(providerFetch).toHaveBeenCalledTimes(1)
    const [, providerRequest] = providerFetch.mock.calls[0]!
    expect((providerRequest as RequestInit).headers).toMatchObject({
      authorization: 'Bearer server-only-secret'
    })
  })

  it('persists generated lessons across server instances with the file store', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gentorial-server-'))
    temporaryDirectories.push(directory)
    const firstGenerate = vi.fn(async () => lesson)
    const first = createGentorialServer({
      generator: { generate: firstGenerate },
      generationProfile: 'test-provider:model-a:prompt-v1',
      cache: { store: createFileGenerationCache({ directory }) }
    })
    const firstClient = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/gentorial/generate',
      fetch: handlerFetch(first.handle)
    })
    await firstClient.generate(input)

    const secondGenerate = vi.fn(async () => ({ ...lesson, markdown: '不应生成' }))
    const second = createGentorialServer({
      generator: { generate: secondGenerate },
      generationProfile: 'test-provider:model-a:prompt-v1',
      cache: { store: createFileGenerationCache({ directory }) }
    })
    const secondClient = createGentorialServerGenerator({
      endpoint: 'https://tutorial.example/api/gentorial/generate',
      fetch: handlerFetch(second.handle)
    })

    await expect(secondClient.generate(input)).resolves.toEqual(lesson)
    expect(firstGenerate).toHaveBeenCalledTimes(1)
    expect(secondGenerate).not.toHaveBeenCalled()
  })

  it('can explicitly disable shared caching', async () => {
    const generateLesson = vi.fn(async () => lesson)
    const server = createGentorialServer({
      generator: { generate: generateLesson },
      generationProfile: 'test-provider:model-a:prompt-v1',
      cache: false
    })
    const request = () => new Request('https://tutorial.example/api/gentorial/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'generate', input })
    })

    expect((await server.handle(request())).headers.get('x-gentorial-cache')).toBe('bypass')
    expect((await server.handle(request())).headers.get('x-gentorial-cache')).toBe('bypass')
    expect(generateLesson).toHaveBeenCalledTimes(2)
  })
})
