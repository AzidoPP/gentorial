import type { GeneratedLesson, LessonBlock } from '@gentorial/core'
import type { GenerationInput, Generator } from './types.js'

export type GentorialGenerationMode = 'generate' | 'stream'

export type GentorialGenerationRequest = {
  mode: GentorialGenerationMode
  input: GenerationInput
}

export type GentorialServerGeneratorOptions = {
  endpoint: string | URL
  fetch?: typeof globalThis.fetch
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
  credentials?: RequestCredentials
}

export type GentorialGenerationAuthorization = (
  request: Request
) => boolean | Response | Promise<boolean | Response>

export type GentorialGenerationHandlerOptions = {
  generator: Generator
  authorize?: GentorialGenerationAuthorization
  headers?: HeadersInit
  cache?: GentorialGenerationCacheOptions
}

export type GentorialGenerationCacheStore = {
  get(key: string): GeneratedLesson | undefined | Promise<GeneratedLesson | undefined>
  set(key: string, lesson: GeneratedLesson): void | Promise<void>
}

export type GentorialGenerationCacheOperation = 'get' | 'set'

export type GentorialGenerationCacheOptions = {
  /**
   * Identifies every server-managed setting that can affect output, for example
   * provider, model, temperature, prompt revision, and output schema revision.
   */
  namespace: string
  store: GentorialGenerationCacheStore
  key?: (input: GenerationInput, namespace: string) => string | Promise<string>
  onError?: (
    error: unknown,
    operation: GentorialGenerationCacheOperation,
    key: string
  ) => void
}

export type GentorialMemoryGenerationCacheOptions = {
  maxEntries?: number
  ttlMs?: number
}

type MemoryCacheEntry = {
  lesson: GeneratedLesson
  expiresAt: number
}

type GentorialCacheStatus = 'hit' | 'miss' | 'bypass'

type StreamEvent = {
  event: string
  data: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function responseError(response: Response): Promise<Error> {
  let message = `Gentorial generation request failed (HTTP ${response.status})`
  try {
    const payload = await response.json() as Record<string, unknown>
    if (typeof payload.error === 'string') message = payload.error
  } catch {
    // The status line remains useful when the endpoint did not return JSON.
  }
  return new Error(message)
}

async function resolveHeaders(options: GentorialServerGeneratorOptions): Promise<Headers> {
  const configured = typeof options.headers === 'function'
    ? await options.headers()
    : options.headers
  const headers = new Headers(configured)
  headers.set('content-type', 'application/json')
  return headers
}

async function postGeneration(
  options: GentorialServerGeneratorOptions,
  fetchImplementation: typeof globalThis.fetch,
  body: GentorialGenerationRequest,
  signal?: AbortSignal
): Promise<Response> {
  const headers = await resolveHeaders(options)
  headers.set('accept', body.mode === 'stream' ? 'text/event-stream' : 'application/json')
  return fetchImplementation(options.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    ...(options.credentials ? { credentials: options.credentials } : {}),
    ...(signal ? { signal } : {})
  })
}

async function* readEventStream(response: Response): AsyncIterable<StreamEvent> {
  if (!response.body) throw new Error('Gentorial generation endpoint returned no response body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const frames = buffer.split(/\r?\n\r?\n/u)
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      let event = 'message'
      const data: string[] = []
      for (const line of frame.split(/\r?\n/u)) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      if (data.length > 0) yield { event, data: data.join('\n') }
    }
    if (done) break
  }
}

function blockMarkdown(block: LessonBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}`
    case 'list':
      return block.items.map((item, index) =>
        `${block.ordered ? `${index + 1}.` : '-'} ${item}`
      ).join('\n')
    case 'code':
      return `${block.caption ? `${block.caption}\n\n` : ''}\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``
    case 'callout':
      return [block.title ? `**${block.title}**` : '', block.text]
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join('\n')
    case 'comparison':
      return [block.left, block.right].map((side) => [
        `### ${side.title}`,
        ...side.items.map((item) => `- ${item}`)
      ].join('\n')).join('\n\n')
  }
}

function lessonMarkdown(lesson: GeneratedLesson): string {
  return lesson.markdown ?? lesson.blocks.map(blockMarkdown).join('\n\n')
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalValue(nested)])
  )
}

export async function createGentorialGenerationCacheKey(
  input: GenerationInput,
  namespace: string
): Promise<string> {
  const canonical = JSON.stringify(canonicalValue({ namespace, input }))
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return `gentorial:${canonical}`

  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `gentorial:${hash}`
}

export function createMemoryGenerationCache(
  options: GentorialMemoryGenerationCacheOptions = {}
): GentorialGenerationCacheStore {
  const maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 1_000))
  const ttlMs = Math.max(1, Math.floor(options.ttlMs ?? 24 * 60 * 60 * 1_000))
  const entries = new Map<string, MemoryCacheEntry>()

  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= Date.now()) {
        entries.delete(key)
        return undefined
      }
      entries.delete(key)
      entries.set(key, entry)
      return entry.lesson
    },
    set(key, lesson) {
      entries.delete(key)
      entries.set(key, { lesson, expiresAt: Date.now() + ttlMs })
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value
        if (typeof oldest !== 'string') break
        entries.delete(oldest)
      }
    }
  }
}

function responseHeaders(
  options: GentorialGenerationHandlerOptions,
  cacheStatus?: GentorialCacheStatus
): Headers {
  const headers = new Headers(options.headers)
  headers.set('cache-control', 'no-store')
  if (cacheStatus) headers.set('x-gentorial-cache', cacheStatus)
  return headers
}

function jsonResponse(
  options: GentorialGenerationHandlerOptions,
  payload: unknown,
  status = 200,
  cacheStatus?: GentorialCacheStatus
): Response {
  const headers = responseHeaders(options, cacheStatus)
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(payload), { status, headers })
}

function streamResponse(
  options: GentorialGenerationHandlerOptions,
  input: GenerationInput,
  request: Request,
  cacheKey?: string
): Response {
  const encoder = new TextEncoder()
  const generation = new AbortController()
  let cancelled = false
  const abort = () => generation.abort(request.signal.reason)
  request.signal.addEventListener('abort', abort, { once: true })

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (cancelled) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        if (options.generator.stream) {
          let markdown = ''
          for await (const text of options.generator.stream(input, { signal: generation.signal })) {
            markdown += text
            send('delta', { text })
          }
          if (markdown && cacheKey) {
            await writeCachedLesson(options, cacheKey, {
              schemaVersion: '1',
              markdown,
              blocks: [{ type: 'paragraph', text: markdown }],
              grounding: {
                conceptIds: [...input.generate.concepts],
                sourceIds: [input.generate.scope.id]
              }
            })
          }
        } else {
          const lesson = await options.generator.generate(input, { signal: generation.signal })
          send('delta', { text: lessonMarkdown(lesson) })
          if (cacheKey) await writeCachedLesson(options, cacheKey, lesson)
        }
        send('done', {})
      } catch (error) {
        if (!generation.signal.aborted) send('error', { error: errorMessage(error) })
      } finally {
        request.signal.removeEventListener('abort', abort)
        if (!cancelled) controller.close()
      }
    },
    cancel(reason) {
      cancelled = true
      generation.abort(reason)
    }
  })

  const headers = responseHeaders(options, cacheKey ? 'miss' : 'bypass')
  headers.set('content-type', 'text/event-stream; charset=utf-8')
  headers.set('x-accel-buffering', 'no')
  return new Response(body, { status: 200, headers })
}

function cachedStreamResponse(
  options: GentorialGenerationHandlerOptions,
  lesson: GeneratedLesson
): Response {
  const encoder = new TextEncoder()
  const markdown = lessonMarkdown(lesson)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(
        `event: delta\ndata: ${JSON.stringify({ text: markdown })}\n\n`
      ))
      controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
      controller.close()
    }
  })
  const headers = responseHeaders(options, 'hit')
  headers.set('content-type', 'text/event-stream; charset=utf-8')
  headers.set('x-accel-buffering', 'no')
  return new Response(body, { status: 200, headers })
}

async function generationCacheKey(
  options: GentorialGenerationHandlerOptions,
  input: GenerationInput
): Promise<string | undefined> {
  if (!options.cache) return undefined
  return options.cache.key
    ? options.cache.key(input, options.cache.namespace)
    : createGentorialGenerationCacheKey(input, options.cache.namespace)
}

async function readCachedLesson(
  options: GentorialGenerationHandlerOptions,
  key: string
): Promise<GeneratedLesson | undefined> {
  try {
    return await options.cache?.store.get(key)
  } catch (error) {
    options.cache?.onError?.(error, 'get', key)
    return undefined
  }
}

async function writeCachedLesson(
  options: GentorialGenerationHandlerOptions,
  key: string,
  lesson: GeneratedLesson
): Promise<void> {
  try {
    await options.cache?.store.set(key, lesson)
  } catch (error) {
    options.cache?.onError?.(error, 'set', key)
  }
}

function generationRequest(value: unknown): GentorialGenerationRequest | undefined {
  if (!value || typeof value !== 'object') return undefined
  const mode = Reflect.get(value, 'mode')
  const input = Reflect.get(value, 'input')
  if ((mode !== 'generate' && mode !== 'stream') || !input || typeof input !== 'object') {
    return undefined
  }
  return { mode, input: input as GenerationInput }
}

export function createGentorialServerGenerator(
  options: GentorialServerGeneratorOptions
): Generator {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  if (!fetchImplementation) throw new Error('This environment does not support fetch')

  return {
    async generate(input, context = {}) {
      const response = await postGeneration(
        options,
        fetchImplementation,
        { mode: 'generate', input },
        context.signal
      )
      if (!response.ok) throw await responseError(response)
      return response.json() as Promise<GeneratedLesson>
    },
    async *stream(input, context = {}) {
      const response = await postGeneration(
        options,
        fetchImplementation,
        { mode: 'stream', input },
        context.signal
      )
      if (!response.ok) throw await responseError(response)

      for await (const message of readEventStream(response)) {
        const payload = JSON.parse(message.data) as Record<string, unknown>
        if (message.event === 'delta' && typeof payload.text === 'string') yield payload.text
        if (message.event === 'error') {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Generation failed')
        }
        if (message.event === 'done') return
      }
    }
  }
}

export function createGentorialGenerationHandler(
  options: GentorialGenerationHandlerOptions
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') {
      const headers = responseHeaders(options)
      headers.set('allow', 'POST')
      return new Response(null, { status: 405, headers })
    }

    if (options.authorize) {
      const authorization = await options.authorize(request)
      if (authorization instanceof Response) return authorization
      if (!authorization) return jsonResponse(options, { error: 'Unauthorized' }, 401)
    }

    let body: GentorialGenerationRequest | undefined
    try {
      body = generationRequest(await request.json())
    } catch {
      body = undefined
    }
    if (!body) return jsonResponse(options, { error: 'Invalid generation request' }, 400)

    const cacheKey = await generationCacheKey(options, body.input)
    const cached = cacheKey ? await readCachedLesson(options, cacheKey) : undefined
    if (cached) {
      return body.mode === 'stream'
        ? cachedStreamResponse(options, cached)
        : jsonResponse(options, cached, 200, 'hit')
    }

    if (body.mode === 'stream') return streamResponse(options, body.input, request, cacheKey)

    try {
      const lesson = await options.generator.generate(body.input, { signal: request.signal })
      if (cacheKey) await writeCachedLesson(options, cacheKey, lesson)
      return jsonResponse(options, lesson, 200, cacheKey ? 'miss' : 'bypass')
    } catch (error) {
      return jsonResponse(options, { error: errorMessage(error) }, 502)
    }
  }
}
