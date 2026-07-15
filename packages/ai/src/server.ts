import {
  learnerProfileSchema,
  lessonConversationTurnSchema,
  type CourseDefinition,
  type CourseManifest,
  type GeneratedLesson,
  type LearnerProfile,
  type LessonBlock,
  type LessonConversationTurn
} from '@gentorial/core'
import type { GenerationInput, Generator } from './types.js'

export type GentorialGenerationMode = 'generate' | 'stream'

export type GentorialGenerationRequest = {
  schemaVersion: '1'
  mode: GentorialGenerationMode
  courseId: string
  generateId: string
  definitionHash: string
  learner?: LearnerProfile
  conversation?: LessonConversationTurn[]
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
  manifests: CourseManifest | readonly CourseManifest[]
  authorize?: GentorialGenerationAuthorization
  headers?: HeadersInit
  cache?: GentorialGenerationCacheOptions
  /** Set to false to disable framework limits. Infrastructure limits should still apply. */
  limits?: GentorialGenerationLimits | false
}

export type GentorialGenerationLimits = {
  maxRequestBytes?: number
  maxInputCharacters?: number
  maxFollowUps?: number
  maxOutputCharacters?: number
}

type ResolvedGenerationLimits = Required<GentorialGenerationLimits>

function normalizedLimit(value: number | undefined, fallback: number, minimum = 1): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.floor(value))
    : fallback
}

function resolveGenerationLimits(
  limits: GentorialGenerationLimits | false | undefined
): ResolvedGenerationLimits | undefined {
  if (limits === false) return undefined
  return {
    maxRequestBytes: normalizedLimit(limits?.maxRequestBytes, 256_000),
    maxInputCharacters: normalizedLimit(limits?.maxInputCharacters, 200_000),
    maxFollowUps: normalizedLimit(limits?.maxFollowUps, 20, 0),
    maxOutputCharacters: normalizedLimit(limits?.maxOutputCharacters, 64_000)
  }
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

function generationOutputCharacters(lesson: GeneratedLesson): number {
  return Math.max(lessonMarkdown(lesson).length, JSON.stringify(lesson).length)
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

function courseWithoutPlugins(course: CourseDefinition | CourseManifest['course']): CourseDefinition {
  const { plugins: _plugins, ...trustedCourse } = course
  return trustedCourse
}

async function sha256(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('SHA-256 is unavailable in this environment')
  const canonical = JSON.stringify(canonicalValue(value))
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Identifies the author-controlled course, section, prompt, and concepts. */
export async function createGentorialGenerationDefinitionHash(
  input: GenerationInput
): Promise<string> {
  const { source: _generateSource, scope, trigger, ...generate } = input.generate
  const hash = await sha256({
    course: courseWithoutPlugins(input.course),
    generate: {
      ...generate,
      scope: {
        type: scope.type,
        id: scope.id,
        heading: scope.heading,
        level: scope.level,
        markdown: scope.markdown
      },
      trigger: { type: trigger.type }
    },
    concepts: input.concepts.map(({ source: _source, ...concept }) => concept)
  })
  return `sha256:${hash}`
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
  cacheKey?: string,
  limits?: ResolvedGenerationLimits
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
            if (limits && markdown.length > limits.maxOutputCharacters) {
              throw new Error(`Generation output exceeds ${limits.maxOutputCharacters} characters`)
            }
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
          const markdown = lessonMarkdown(lesson)
          if (limits && markdown.length > limits.maxOutputCharacters) {
            throw new Error(`Generation output exceeds ${limits.maxOutputCharacters} characters`)
          }
          send('delta', { text: markdown })
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
  const allowedKeys = new Set([
    'schemaVersion',
    'mode',
    'courseId',
    'generateId',
    'definitionHash',
    'learner',
    'conversation'
  ])
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return undefined
  const schemaVersion = Reflect.get(value, 'schemaVersion')
  const mode = Reflect.get(value, 'mode')
  const courseId = Reflect.get(value, 'courseId')
  const generateId = Reflect.get(value, 'generateId')
  const definitionHash = Reflect.get(value, 'definitionHash')
  const learner = Reflect.get(value, 'learner')
  const conversation = Reflect.get(value, 'conversation')
  if (
    schemaVersion !== '1'
    || (mode !== 'generate' && mode !== 'stream')
    || typeof courseId !== 'string'
    || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/iu.test(courseId)
    || typeof generateId !== 'string'
    || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/iu.test(generateId)
    || typeof definitionHash !== 'string'
    || !/^sha256:[a-f0-9]{64}$/u.test(definitionHash)
    || (learner !== undefined && !learnerProfileSchema.safeParse(learner).success)
    || (conversation !== undefined && (
      !Array.isArray(conversation)
      || conversation.some((turn) => !lessonConversationTurnSchema.safeParse(turn).success)
    ))
  ) {
    return undefined
  }
  return {
    schemaVersion: '1',
    mode,
    courseId,
    generateId,
    definitionHash,
    ...(learner !== undefined ? { learner: learner as LearnerProfile } : {}),
    ...(conversation !== undefined
      ? { conversation: conversation as LessonConversationTurn[] }
      : {})
  }
}

function trustedManifestMap(
  configured: CourseManifest | readonly CourseManifest[]
): Map<string, CourseManifest> {
  const manifests = Array.isArray(configured) ? configured : [configured]
  const byCourseId = new Map<string, CourseManifest>()
  for (const manifest of manifests) {
    if (byCourseId.has(manifest.course.id)) {
      throw new Error(`Duplicate trusted Gentorial course ${manifest.course.id}`)
    }
    byCourseId.set(manifest.course.id, manifest)
  }
  return byCourseId
}

async function trustedInput(
  manifests: Map<string, CourseManifest>,
  request: GentorialGenerationRequest
): Promise<{ input?: GenerationInput; status?: number; error?: string }> {
  const manifest = manifests.get(request.courseId)
  if (!manifest) return { status: 404, error: 'Unknown Gentorial course' }
  const generate = manifest.generates.find((candidate) => candidate.id === request.generateId)
  if (!generate) return { status: 404, error: 'Unknown Gentorial generation target' }

  const concepts = generate.concepts.map((conceptId) =>
    manifest.concepts.find((concept) => concept.id === conceptId)
  )
  if (concepts.some((concept) => !concept)) {
    return { status: 500, error: 'Trusted Gentorial manifest has missing concepts' }
  }

  const input: GenerationInput = {
    course: courseWithoutPlugins(manifest.course),
    generate,
    concepts: concepts.filter((concept) => concept !== undefined),
    ...(request.learner ? { learner: request.learner } : {}),
    ...(request.conversation ? { conversation: request.conversation } : {})
  }
  const expectedHash = await createGentorialGenerationDefinitionHash(input)
  if (expectedHash !== request.definitionHash) {
    return { status: 409, error: 'Gentorial course content changed; refresh the page and retry' }
  }
  return { input }
}

export function createGentorialServerGenerator(
  options: GentorialServerGeneratorOptions
): Generator {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  if (!fetchImplementation) throw new Error('This environment does not support fetch')

  return {
    async generate(input, context = {}) {
      const request: GentorialGenerationRequest = {
        schemaVersion: '1',
        mode: 'generate',
        courseId: input.course.id,
        generateId: input.generate.id,
        definitionHash: await createGentorialGenerationDefinitionHash(input),
        ...(input.learner ? { learner: input.learner } : {}),
        ...(input.conversation ? { conversation: input.conversation } : {})
      }
      const response = await postGeneration(
        options,
        fetchImplementation,
        request,
        context.signal
      )
      if (!response.ok) throw await responseError(response)
      return response.json() as Promise<GeneratedLesson>
    },
    async *stream(input, context = {}) {
      const request: GentorialGenerationRequest = {
        schemaVersion: '1',
        mode: 'stream',
        courseId: input.course.id,
        generateId: input.generate.id,
        definitionHash: await createGentorialGenerationDefinitionHash(input),
        ...(input.learner ? { learner: input.learner } : {}),
        ...(input.conversation ? { conversation: input.conversation } : {})
      }
      const response = await postGeneration(
        options,
        fetchImplementation,
        request,
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
  const manifests = trustedManifestMap(options.manifests)
  const limits = resolveGenerationLimits(options.limits)
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

    const declaredLength = Number(request.headers.get('content-length'))
    if (limits && Number.isFinite(declaredLength) && declaredLength > limits.maxRequestBytes) {
      return jsonResponse(options, { error: 'Generation request is too large' }, 413)
    }

    let body: GentorialGenerationRequest | undefined
    try {
      const raw = await request.text()
      if (limits && new TextEncoder().encode(raw).byteLength > limits.maxRequestBytes) {
        return jsonResponse(options, { error: 'Generation request is too large' }, 413)
      }
      body = generationRequest(JSON.parse(raw))
    } catch {
      body = undefined
    }
    if (!body) return jsonResponse(options, { error: 'Invalid generation request' }, 400)

    const trusted = await trustedInput(manifests, body)
    if (!trusted.input) {
      return jsonResponse(options, { error: trusted.error ?? 'Invalid generation request' }, trusted.status ?? 400)
    }
    const input = trusted.input

    if (limits) {
      const followUps = input.conversation?.filter((turn) => turn.role === 'user').length ?? 0
      if (followUps > limits.maxFollowUps) {
        return jsonResponse(
          options,
          { error: `Generation conversation exceeds ${limits.maxFollowUps} follow-ups` },
          413
        )
      }
      if (JSON.stringify(input).length > limits.maxInputCharacters) {
        return jsonResponse(
          options,
          { error: `Generation input exceeds ${limits.maxInputCharacters} characters` },
          413
        )
      }
    }

    const cacheKey = await generationCacheKey(options, input)
    const cached = cacheKey ? await readCachedLesson(options, cacheKey) : undefined
    if (cached && (!limits || generationOutputCharacters(cached) <= limits.maxOutputCharacters)) {
      return body.mode === 'stream'
        ? cachedStreamResponse(options, cached)
        : jsonResponse(options, cached, 200, 'hit')
    }

    if (body.mode === 'stream') return streamResponse(options, input, request, cacheKey, limits)

    try {
      const lesson = await options.generator.generate(input, { signal: request.signal })
      if (limits && generationOutputCharacters(lesson) > limits.maxOutputCharacters) {
        return jsonResponse(
          options,
          { error: `Generation output exceeds ${limits.maxOutputCharacters} characters` },
          502
        )
      }
      if (cacheKey) await writeCachedLesson(options, cacheKey, lesson)
      return jsonResponse(options, lesson, 200, cacheKey ? 'miss' : 'bypass')
    } catch (error) {
      return jsonResponse(options, { error: errorMessage(error) }, 502)
    }
  }
}
