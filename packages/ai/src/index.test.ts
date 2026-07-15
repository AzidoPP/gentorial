import { describe, expect, it, vi } from 'vitest'
import { defineCourse, type ConceptSpec, type GenerateSpec } from '@gentorial/core'
import {
  compileGenerationPrompt,
  createBrowserByokGenerator,
  createMockGenerator,
  createProviderGenerator,
  type GenerationInput
} from './index.js'

const course = defineCourse({
  schemaVersion: '1',
  id: 'c-language',
  title: 'C 语言教程',
  lang: 'zh-CN',
  contentDir: 'content',
  generation: { mode: 'hybrid', defaultLocale: 'zh-CN' },
  accuracy: {
    policies: ['概念锚点不可被反转'],
    standards: ['ISO C17']
  }
})

const concept: ConceptSpec = {
  id: 'switch-discrete',
  statement: 'switch 根据离散结果选择分支。',
  source: { file: 'content/index.md', line: 1 }
}

const generate: GenerateSpec = {
  id: 'switch-range',
  kind: 'example',
  prompt: '说明 switch 不适合连续范围。',
  concepts: ['switch-discrete'],
  scope: {
    type: 'section',
    id: 'section-switch',
    heading: 'switch 的适用边界',
    level: 2,
    markdown: '`switch` 根据离散结果选择分支。',
    source: { file: 'content/index.md', line: 1 }
  },
  trigger: {
    type: 'heading',
    source: { file: 'content/index.md', line: 1 }
  },
  output: { placement: 'after-source', mode: 'replace' },
  source: { file: 'content/index.md', line: 5 }
}

const input: GenerationInput = {
  course,
  concepts: [concept],
  generate,
  learner: {
    goal: '准备考试',
    detail: 'deep',
    narrative: 'comparison'
  }
}

const previousLesson = {
  schemaVersion: '1' as const,
  blocks: [{ type: 'paragraph' as const, text: 'switch 适合离散分支。' }],
  grounding: {
    conceptIds: ['switch-discrete'],
    sourceIds: ['section-switch']
  }
}

const followUpInput: GenerationInput = {
  ...input,
  conversation: [
    { role: 'assistant', lesson: previousLesson },
    { role: 'user', content: '那连续范围应该怎么写？' }
  ]
}

describe('compileGenerationPrompt', () => {
  it('includes policies, scope, concepts and learner profile', () => {
    const prompt = compileGenerationPrompt(input)

    expect(prompt.input).toContain('概念锚点不可被反转')
    expect(prompt.input).toContain('switch-discrete')
    expect(prompt.input).toContain('section-switch')
    expect(prompt.input).toContain('`switch` 根据离散结果选择分支。')
    expect(prompt.input).toContain('准备考试')
    expect(prompt.input).toContain('comparison')
    expect(prompt.system).toContain('grounding.sourceIds')
  })

  it('includes the lesson conversation and preserves its grounding constraints', () => {
    const prompt = compileGenerationPrompt(followUpInput)
    const payload = JSON.parse(prompt.input) as { conversation: unknown[] }

    expect(payload.conversation).toEqual(followUpInput.conversation)
    expect(prompt.system).toContain('后续问答必须继承当前 scope、概念锚点和课程准确性策略')
    expect(prompt.system).toContain('grounding.sourceIds 与 grounding.conceptIds 的规则保持不变')
    expect(prompt.system).toContain('不得依赖界面重复显示用户问题')
  })
})

describe('createMockGenerator', () => {
  it('returns deterministic lesson blocks', async () => {
    const lesson = await createMockGenerator().generate(input)

    expect(lesson.grounding.conceptIds).toEqual(['switch-discrete'])
    expect(lesson.grounding.sourceIds).toEqual(['section-switch'])
    expect(lesson.blocks[0]).toMatchObject({
      type: 'paragraph',
      text: expect.stringContaining('对照来看，')
    })
    expect(JSON.stringify(lesson)).not.toMatch(/确定性|Mock|叙事=|详略=|依据：/u)
  })

  it('supports section-only generation without concepts', async () => {
    const sectionOnlyInput: GenerationInput = {
      ...input,
      concepts: [],
      generate: { ...generate, concepts: [] },
      learner: { detail: 'concise', narrative: 'timeline' }
    }

    const lesson = await createMockGenerator().generate(sectionOnlyInput)

    expect(lesson.grounding.conceptIds).toEqual([])
    expect(lesson.grounding.sourceIds).toEqual(['section-switch'])
    expect(lesson.blocks[0]).toMatchObject({ text: expect.stringContaining('顺着发展顺序看，') })
  })

  it('returns a deterministic, source-grounded answer to the latest user question', async () => {
    const lesson = await createMockGenerator().generate(followUpInput)

    expect(lesson.blocks[0]).toMatchObject({
      type: 'paragraph',
      text: expect.stringContaining('那连续范围应该怎么写？')
    })
    expect(lesson.blocks[0]).toMatchObject({
      text: expect.stringContaining('“switch 的适用边界”中的核心线索')
    })
    expect(lesson.blocks[0]).toMatchObject({ text: expect.stringContaining('对照来看，') })
    expect(lesson.blocks[0]).toMatchObject({
      text: expect.stringContaining('把这些线索逐项对照')
    })
    expect(JSON.stringify(lesson)).not.toMatch(/确定性|Mock|叙事=|详略=|依据：/u)
    expect(lesson.grounding.conceptIds).toEqual(['switch-discrete'])
    expect(lesson.grounding.sourceIds).toEqual(['section-switch'])
  })
})

describe('createBrowserByokGenerator', () => {
  const lessonResponse = {
    schemaVersion: '1',
    blocks: [{ type: 'paragraph', text: '真实提供方返回的讲解。' }],
    grounding: { conceptIds: ['switch-discrete'], sourceIds: ['section-switch'] }
  }

  it.each([
    {
      provider: 'openai' as const,
      response: { choices: [{ message: { content: JSON.stringify(lessonResponse) } }] },
      baseUrl: 'https://proxy.example/openai/v1',
      url: 'https://proxy.example/openai/v1/chat/completions',
      header: 'authorization'
    },
    {
      provider: 'anthropic' as const,
      response: { content: [{ type: 'text', text: JSON.stringify(lessonResponse) }] },
      baseUrl: 'https://proxy.example/anthropic/v1',
      url: 'https://proxy.example/anthropic/v1/messages',
      header: 'x-api-key'
    },
    {
      provider: 'google' as const,
      response: { candidates: [{ content: { parts: [{ text: JSON.stringify(lessonResponse) }] } }] },
      baseUrl: 'https://proxy.example/google/v1beta',
      url: 'https://proxy.example/google/v1beta/models/test-model:generateContent',
      header: 'x-goog-api-key'
    },
    {
      provider: 'custom' as const,
      response: { choices: [{ message: { content: JSON.stringify(lessonResponse) } }] },
      baseUrl: 'https://local.example/v1',
      url: 'https://local.example/v1/chat/completions',
      header: 'authorization'
    }
  ])('sends $provider structured output', async ({ provider, response, baseUrl, url, header }) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))
    const generator = createBrowserByokGenerator(
      { provider, apiKey: 'test-secret', model: 'test-model', baseUrl },
      { fetch: fetchMock as typeof fetch }
    )

    const lesson = await generator.generate(input)

    expect(lesson).toEqual(lessonResponse)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [requestUrl, init] = fetchMock.mock.calls[0]!
    expect(requestUrl).toBe(url)
    expect((init as RequestInit).headers).toMatchObject({ [header]: expect.stringContaining('test-secret') })
    expect((init as RequestInit).body).not.toContain('test-secret')
  })

  it('streams OpenAI-compatible Markdown chunks without custom-container instructions', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"第一段"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"，第二段"}}]}',
      '',
      'data: [DONE]',
      ''
    ].join('\n')
    const fetchMock = vi.fn(async () => new Response(sse, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    }))
    const generator = createBrowserByokGenerator(
      {
        provider: 'custom',
        apiKey: 'test-secret',
        model: 'test-model',
        baseUrl: 'https://local.example/v1'
      },
      { fetch: fetchMock as typeof fetch }
    )

    const chunks: string[] = []
    for await (const chunk of generator.stream!(input)) chunks.push(chunk)

    expect(chunks).toEqual(['第一段', '，第二段'])
    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse((init as RequestInit).body as string) as {
      stream: boolean
      messages: Array<{ content: string }>
    }
    expect(body.stream).toBe(true)
    expect(body.messages[0]?.content).toContain('标准 Markdown')
    expect(body.messages[0]?.content).toContain('不要输出 JSON、HTML、脚本、协议字段或自定义容器')
  })
})

describe('createProviderGenerator', () => {
  it('uses a server-managed Anthropic key without browser-direct headers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({
        schemaVersion: '1',
        blocks: [{ type: 'paragraph', text: 'server result' }],
        grounding: { conceptIds: ['switch-discrete'], sourceIds: ['section-switch'] }
      }) }]
    })))
    const generator = createProviderGenerator({
      provider: 'anthropic',
      apiKey: 'server-secret',
      model: 'server-model'
    }, { fetch: fetchMock as typeof fetch })

    await generator.generate(input)

    const [, init] = fetchMock.mock.calls[0]!
    expect((init as RequestInit).headers).toMatchObject({
      'x-api-key': 'server-secret',
      'anthropic-version': '2023-06-01'
    })
    expect((init as RequestInit).headers).not.toHaveProperty(
      'anthropic-dangerous-direct-browser-access'
    )
  })
})
