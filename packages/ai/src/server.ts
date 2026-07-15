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
}

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

function responseHeaders(options: GentorialGenerationHandlerOptions): Headers {
  const headers = new Headers(options.headers)
  headers.set('cache-control', 'no-store')
  return headers
}

function jsonResponse(
  options: GentorialGenerationHandlerOptions,
  payload: unknown,
  status = 200
): Response {
  const headers = responseHeaders(options)
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(payload), { status, headers })
}

function streamResponse(
  options: GentorialGenerationHandlerOptions,
  input: GenerationInput,
  request: Request
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
          for await (const text of options.generator.stream(input, { signal: generation.signal })) {
            send('delta', { text })
          }
        } else {
          const lesson = await options.generator.generate(input, { signal: generation.signal })
          send('delta', { text: lessonMarkdown(lesson) })
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

  const headers = responseHeaders(options)
  headers.set('content-type', 'text/event-stream; charset=utf-8')
  headers.set('x-accel-buffering', 'no')
  return new Response(body, { status: 200, headers })
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

    if (body.mode === 'stream') return streamResponse(options, body.input, request)

    try {
      const lesson = await options.generator.generate(body.input, { signal: request.signal })
      return jsonResponse(options, lesson)
    } catch (error) {
      return jsonResponse(options, { error: errorMessage(error) }, 502)
    }
  }
}
