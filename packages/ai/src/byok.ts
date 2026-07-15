import { createGenerationPipeline } from './pipeline.js'
import { defaultPromptCompiler } from './prompt.js'
import type {
  CompiledPrompt,
  Generator,
  ProviderAdapter,
  TransportContext
} from './types.js'

export type BrowserByokProvider = 'openai' | 'anthropic' | 'google' | 'custom'

export type BrowserByokCredentials = {
  provider: BrowserByokProvider
  apiKey: string
  model?: string
  baseUrl?: string
  /** @deprecated Use baseUrl. Full provider endpoints remain accepted for compatibility. */
  endpoint?: string
}

export type BrowserByokGeneratorOptions = {
  fetch?: typeof globalThis.fetch
}

type BrowserRequest = {
  url: string
  headers: Record<string, string>
  body: unknown
}

const defaultModels: Record<Exclude<BrowserByokProvider, 'custom'>, string> = {
  openai: 'gpt-5.6-terra',
  anthropic: 'claude-sonnet-5',
  google: 'gemini-3.5-flash'
}

function cleanEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/u, '')
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim()
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')
    : trimmed
  return JSON.parse(unfenced)
}

function responseText(value: unknown, provider: BrowserByokProvider): string {
  if (!value || typeof value !== 'object') throw new Error(`${provider} 返回了空响应`)
  const response = value as Record<string, unknown>

  if (provider === 'anthropic') {
    const content = Array.isArray(response.content) ? response.content : []
    const text = content.find((item) =>
      item && typeof item === 'object' && Reflect.get(item, 'type') === 'text'
    )
    const result = text && typeof text === 'object' ? Reflect.get(text, 'text') : undefined
    if (typeof result === 'string') return result
  } else if (provider === 'google') {
    const candidates = Array.isArray(response.candidates) ? response.candidates : []
    const parts = candidates[0] && typeof candidates[0] === 'object'
      ? Reflect.get(Reflect.get(candidates[0], 'content') ?? {}, 'parts')
      : undefined
    const first = Array.isArray(parts) ? parts[0] : undefined
    const result = first && typeof first === 'object' ? Reflect.get(first, 'text') : undefined
    if (typeof result === 'string') return result
  } else {
    const choices = Array.isArray(response.choices) ? response.choices : []
    const message = choices[0] && typeof choices[0] === 'object'
      ? Reflect.get(choices[0], 'message')
      : undefined
    const result = message && typeof message === 'object' ? Reflect.get(message, 'content') : undefined
    if (typeof result === 'string') return result
  }

  throw new Error(`${provider} 响应中没有可读取的结构化文本`)
}

function createAdapter(credentials: BrowserByokCredentials): ProviderAdapter<BrowserRequest, unknown> {
  const provider = credentials.provider
  const apiKey = credentials.apiKey.trim()
  if (!apiKey) throw new Error('API key 不能为空')

  if (provider === 'anthropic') {
    const model = credentials.model?.trim() || defaultModels.anthropic
    const baseUrl = cleanEndpoint(
      credentials.baseUrl || credentials.endpoint || 'https://api.anthropic.com/v1'
    )
    return {
      id: provider,
      createRequest(prompt: CompiledPrompt) {
        return {
          url: baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`,
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: {
            model,
            max_tokens: 8192,
            system: prompt.system,
            messages: [{ role: 'user', content: prompt.input }]
          }
        }
      },
      readStructuredResult(response) {
        return parseJsonText(responseText(response, provider))
      }
    }
  }

  if (provider === 'google') {
    const model = credentials.model?.trim() || defaultModels.google
    const baseUrl = cleanEndpoint(
      credentials.baseUrl || credentials.endpoint || 'https://generativelanguage.googleapis.com/v1beta'
    )
    const endpoint = baseUrl.endsWith(':generateContent')
      ? baseUrl
      : `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`
    return {
      id: provider,
      createRequest(prompt: CompiledPrompt) {
        return {
          url: endpoint,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: {
            systemInstruction: { parts: [{ text: prompt.system }] },
            contents: [{ role: 'user', parts: [{ text: prompt.input }] }],
            generationConfig: { responseMimeType: 'application/json' }
          }
        }
      },
      readStructuredResult(response) {
        return parseJsonText(responseText(response, provider))
      }
    }
  }

  const model = credentials.model?.trim() || (provider === 'openai' ? defaultModels.openai : '')
  if (!model) throw new Error('OpenAI-compatible 提供方必须填写模型名称')
  const configuredBaseUrl = credentials.baseUrl || credentials.endpoint
  if (provider === 'custom' && !configuredBaseUrl?.trim()) {
    throw new Error('OpenAI-compatible 提供方必须填写 Base URL')
  }
  const base = cleanEndpoint(configuredBaseUrl || 'https://api.openai.com/v1')
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
  return {
    id: provider,
    createRequest(prompt: CompiledPrompt) {
      return {
        url,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: {
          model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.input }
          ],
          response_format: { type: 'json_object' }
        }
      }
    },
    readStructuredResult(response) {
      return parseJsonText(responseText(response, provider))
    }
  }
}

function createBrowserTransport(fetchImplementation: typeof globalThis.fetch) {
  return {
    async send(request: BrowserRequest, context: TransportContext): Promise<unknown> {
      const response = await fetchImplementation(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        ...(context.signal ? { signal: context.signal } : {})
      })
      if (!response.ok) {
        let detail = ''
        try {
          const payload = await response.json() as Record<string, unknown>
          const error = payload.error
          detail = error && typeof error === 'object' && typeof Reflect.get(error, 'message') === 'string'
            ? `：${Reflect.get(error, 'message')}`
            : ''
        } catch {
          detail = ''
        }
        throw new Error(`${context.providerId} 请求失败（HTTP ${response.status}）${detail}`)
      }
      return response.json()
    }
  }
}

async function responseError(response: Response, provider: BrowserByokProvider): Promise<Error> {
  let detail = ''
  try {
    const payload = await response.json() as Record<string, unknown>
    const error = payload.error
    detail = error && typeof error === 'object' && typeof Reflect.get(error, 'message') === 'string'
      ? `：${Reflect.get(error, 'message')}`
      : ''
  } catch {
    detail = ''
  }
  return new Error(`${provider} 请求失败（HTTP ${response.status}）${detail}`)
}

async function* readSse(response: Response): AsyncIterable<string> {
  if (!response.body) throw new Error('提供方没有返回可读取的响应流')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const events = buffer.split(/\r?\n\r?\n/u)
    buffer = events.pop() ?? ''
    for (const event of events) {
      const data = event
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (data) yield data
    }
    if (done) break
  }

  const tail = buffer
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (tail) yield tail
}

function streamedText(data: string, provider: BrowserByokProvider): string | undefined {
  if (data === '[DONE]') return undefined
  const value = JSON.parse(data) as Record<string, unknown>

  if (provider === 'anthropic') {
    const delta = value.delta
    const text = delta && typeof delta === 'object' ? Reflect.get(delta, 'text') : undefined
    return typeof text === 'string' ? text : undefined
  }
  if (provider === 'google') {
    const candidates = Array.isArray(value.candidates) ? value.candidates : []
    const content = candidates[0] && typeof candidates[0] === 'object'
      ? Reflect.get(candidates[0], 'content')
      : undefined
    const parts = content && typeof content === 'object' ? Reflect.get(content, 'parts') : undefined
    if (!Array.isArray(parts)) return undefined
    const text = parts
      .map((part) => part && typeof part === 'object' ? Reflect.get(part, 'text') : undefined)
      .filter((part): part is string => typeof part === 'string')
      .join('')
    return text || undefined
  }

  const choices = Array.isArray(value.choices) ? value.choices : []
  const delta = choices[0] && typeof choices[0] === 'object'
    ? Reflect.get(choices[0], 'delta')
    : undefined
  const text = delta && typeof delta === 'object' ? Reflect.get(delta, 'content') : undefined
  return typeof text === 'string' ? text : undefined
}

function streamingRequest(request: BrowserRequest, provider: BrowserByokProvider): BrowserRequest {
  const body = request.body as Record<string, unknown>
  if (provider === 'google') {
    const url = request.url.replace(/:generateContent$/u, ':streamGenerateContent')
    const separator = url.includes('?') ? '&' : '?'
    const { generationConfig: _generationConfig, ...rest } = body
    return { ...request, url: `${url}${separator}alt=sse`, body: rest }
  }
  const { response_format: _responseFormat, ...rest } = body
  return { ...request, body: { ...rest, stream: true } }
}

function streamingPrompt(input: Parameters<Generator['generate']>[0]): CompiledPrompt {
  const prompt = defaultPromptCompiler.compile(input)
  return {
    ...prompt,
    system: [
      '你是 Gentorial 的课程讲解助手。',
      '遵守输入中的课程范围、概念原文、准确性策略和学习者偏好。',
      '直接输出适合 VitePress 展示的标准 Markdown 正文；不要输出 JSON、HTML、脚本、协议字段或自定义容器。',
      '可以使用段落、标题、列表、引用、链接、强调、行内代码和代码围栏。图示仅使用 mermaid 代码围栏。'
    ].join('\n'),
    input: prompt.input
  }
}

export function createBrowserByokGenerator(
  credentials: BrowserByokCredentials,
  options: BrowserByokGeneratorOptions = {}
): Generator {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  if (!fetchImplementation) throw new Error('当前环境不支持 fetch')
  const adapter = createAdapter(credentials)
  const generator = createGenerationPipeline({
    adapter,
    transport: createBrowserTransport(fetchImplementation)
  })
  return {
    ...generator,
    async *stream(input, context = {}) {
      const request = streamingRequest(
        adapter.createRequest(streamingPrompt(input)),
        credentials.provider
      )
      const response = await fetchImplementation(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        ...(context.signal ? { signal: context.signal } : {})
      })
      if (!response.ok) throw await responseError(response, credentials.provider)
      for await (const data of readSse(response)) {
        const text = streamedText(data, credentials.provider)
        if (text) yield text
      }
    }
  }
}
