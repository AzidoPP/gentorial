import type {
  ConceptSpec,
  GeneratedLesson,
  GenerateSpec
} from '@gentorial/core'
import { describe, expect, it, vi } from 'vitest'
import { createGentorialRuntime } from './index.js'

const source = { file: 'content/index.md', line: 1 }

const concept: ConceptSpec = {
  id: 'c-history-anchor',
  statement: 'ALGOL → CPL → BCPL → B → C',
  source
}

const spec: GenerateSpec = {
  id: 'c-history',
  kind: 'explanation',
  prompt: '解释 C 语言的演化脉络。',
  concepts: [concept.id],
  scope: {
    type: 'section',
    id: 'c-history-section',
    heading: 'C 的历史',
    level: 2,
    markdown: '1. ALGOL CPL BCPL\n2. B\n3. C',
    source
  },
  trigger: { type: 'heading', source },
  output: { placement: 'after-source', mode: 'replace' },
  source
}

function lesson(text: string): GeneratedLesson {
  return {
    schemaVersion: '1',
    blocks: [{ type: 'paragraph', text }],
    grounding: {
      conceptIds: [concept.id],
      sourceIds: [spec.scope.id]
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('createGentorialRuntime', () => {
  it('renders streamed text incrementally and commits it as a lesson', async () => {
    const gate = deferred<void>()
    const runtime = createGentorialRuntime({
      generate() {
        return (async function* () {
          yield '第一段'
          await gate.promise
          yield '，第二段'
        })()
      }
    })
    runtime.register({ generate: spec, concepts: [concept] })

    const running = runtime.run(spec.id)
    await vi.waitFor(() => {
      expect(runtime.getState(spec.id)).toMatchObject({
        status: 'loading',
        markdown: '第一段',
        blocks: [{ type: 'paragraph', text: '第一段' }]
      })
    })

    gate.resolve()
    await running
    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'success',
      markdown: '第一段，第二段',
      blocks: [{ type: 'paragraph', text: '第一段，第二段' }]
    })
  })

  it('registers a region and runs it with the current global learner profile', async () => {
    const generate = vi.fn().mockResolvedValue(lesson('mock'))
    const runtime = createGentorialRuntime({
      learnerProfile: { detail: 'deep', narrative: 'timeline' },
      generate
    })
    const unregister = runtime.register({
      generate: spec,
      concepts: [concept],
      fallback: [{ type: 'paragraph', text: 'fallback' }]
    })

    await runtime.run(spec.id)

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        generate: spec,
        concepts: [concept],
        learner: expect.objectContaining({
          detail: 'deep',
          narrative: 'timeline',
          tone: 'neutral'
        })
      }),
      { signal: expect.any(AbortSignal) }
    )
    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'success',
      blocks: [{ type: 'paragraph', text: 'mock' }],
      fallback: [{ type: 'paragraph', text: 'fallback' }]
    })

    unregister()
    expect(runtime.getState(spec.id).status).toBe('idle')
  })

  it('uses a registration learner profile instead of the global profile', async () => {
    const generate = vi.fn().mockResolvedValue(lesson('local'))
    const runtime = createGentorialRuntime({
      learnerProfile: { detail: 'concise' },
      generate
    })
    runtime.register({
      generate: spec,
      concepts: [concept],
      learner: { detail: 'deep', tone: 'conversational' }
    })

    await runtime.run(spec.id)

    expect(generate.mock.calls[0]?.[0].learner).toEqual({
      detail: 'deep',
      tone: 'conversational'
    })
  })

  it('updates preferences without changing an already registered request', async () => {
    const generate = vi.fn().mockResolvedValue(lesson('preferences'))
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    runtime.setLearnerProfile({
      detail: 'concise',
      tone: 'formal',
      narrative: 'comparison'
    })
    await runtime.run(spec.id)

    expect(runtime.learnerProfile.value).toEqual({
      detail: 'concise',
      tone: 'formal',
      narrative: 'comparison'
    })
    expect(generate.mock.calls[0]?.[0].learner).toEqual(runtime.learnerProfile.value)
  })

  it('forwards the in-memory BYOK session only through generation context', async () => {
    const generate = vi.fn().mockResolvedValue(lesson('byok'))
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })
    runtime.setByokSession({
      provider: 'custom',
      apiKey: 'session-secret',
      model: 'local-model',
      endpoint: 'http://localhost:11434/v1'
    })

    await runtime.run(spec.id)

    expect(generate.mock.calls[0]?.[1]).toMatchObject({
      byok: {
        provider: 'custom',
        apiKey: 'session-secret',
        model: 'local-model',
        endpoint: 'http://localhost:11434/v1'
      }
    })
    expect(generate.mock.calls[0]?.[0]).not.toHaveProperty('byok')
  })

  it('aborts a request and ignores a result that arrives after cancellation', async () => {
    const pending = deferred<GeneratedLesson>()
    let signal: AbortSignal | undefined
    const runtime = createGentorialRuntime({
      generate: vi.fn((_request, context) => {
        signal = context.signal
        return pending.promise
      })
    })
    runtime.register({ generate: spec, concepts: [concept] })

    const running = runtime.run(spec.id)
    expect(runtime.getState(spec.id).status).toBe('loading')

    runtime.cancel(spec.id)
    expect(signal?.aborted).toBe(true)
    expect(runtime.getState(spec.id).status).toBe('idle')

    pending.resolve(lesson('too late'))
    await running
    expect(runtime.getState(spec.id)).toMatchObject({ status: 'idle', blocks: [] })
  })

  it('allows only the newest concurrent request to replace the generated blocks', async () => {
    const first = deferred<GeneratedLesson>()
    const second = deferred<GeneratedLesson>()
    const generate = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    const firstRun = runtime.run(spec.id)
    const secondRun = runtime.run(spec.id)
    second.resolve(lesson('new result'))
    await secondRun
    first.resolve(lesson('stale result'))
    await firstRun

    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'success',
      blocks: [{ type: 'paragraph', text: 'new result' }]
    })
  })

  it('keeps the successful blocks stable while a replacement is loading', async () => {
    const replacement = deferred<GeneratedLesson>()
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson('existing result'))
      .mockImplementationOnce(() => replacement.promise)
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.run(spec.id)
    const refreshing = runtime.run(spec.id)

    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'loading',
      blocks: [{ type: 'paragraph', text: 'existing result' }],
      conversation: []
    })

    replacement.resolve(lesson('replacement result'))
    await refreshing
    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'success',
      blocks: [{ type: 'paragraph', text: 'replacement result' }]
    })
  })

  it('sends the base lesson and complete prior conversation on every follow-up', async () => {
    const base = lesson('base explanation')
    const firstReply = lesson('first answer')
    const secondReply = lesson('second answer')
    const generate = vi
      .fn()
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce(firstReply)
      .mockResolvedValueOnce(secondReply)
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.run(spec.id)
    await runtime.ask(spec.id, ' 为什么会从 B 演化到 C？ ')
    await runtime.ask(spec.id, '这和可移植性有什么关系？')

    expect(generate.mock.calls[1]?.[0]).toMatchObject({
      generate: spec,
      concepts: [concept],
      conversation: [
        { role: 'assistant', lesson: base },
        { role: 'user', content: '为什么会从 B 演化到 C？' }
      ]
    })
    expect(generate.mock.calls[2]?.[0].conversation).toEqual([
      { role: 'assistant', lesson: base },
      { role: 'user', content: '为什么会从 B 演化到 C？' },
      { role: 'assistant', lesson: firstReply },
      { role: 'user', content: '这和可移植性有什么关系？' }
    ])
    expect(runtime.getState(spec.id)).toMatchObject({
      followUpStatus: 'idle',
      followUpError: undefined,
      conversation: [
        { role: 'user', content: '为什么会从 B 演化到 C？' },
        { role: 'assistant', lesson: firstReply },
        { role: 'user', content: '这和可移植性有什么关系？' },
        { role: 'assistant', lesson: secondReply }
      ]
    })
  })

  it('keeps each follow-up lesson exactly as returned by the generator', async () => {
    const followUp = {
      ...lesson('grounded follow-up'),
      grounding: {
        conceptIds: ['generator-selected-concept'],
        sourceIds: ['generator-selected-source']
      }
    } satisfies GeneratedLesson
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson('base'))
      .mockResolvedValueOnce(followUp)
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.run(spec.id)
    await runtime.ask(spec.id, '请给出依据。')

    expect(runtime.getState(spec.id).conversation[1]).toEqual({
      role: 'assistant',
      lesson: followUp
    })
  })

  it('keeps completed conversation unchanged when a follow-up is cancelled', async () => {
    const pending = deferred<GeneratedLesson>()
    let signal: AbortSignal | undefined
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson('base'))
      .mockImplementationOnce((_request, context) => {
        signal = context.signal
        return pending.promise
      })
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.run(spec.id)
    const asking = runtime.ask(spec.id, '这个过程为什么重要？')
    expect(runtime.getState(spec.id)).toMatchObject({
      followUpStatus: 'loading',
      conversation: []
    })

    runtime.cancelFollowUp(spec.id)
    expect(signal?.aborted).toBe(true)
    pending.resolve(lesson('too late'))
    await asking

    expect(runtime.getState(spec.id)).toMatchObject({
      followUpStatus: 'idle',
      followUpError: undefined,
      conversation: []
    })
  })

  it('keeps completed conversation unchanged when a follow-up fails', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson('base'))
      .mockRejectedValueOnce(new Error('follow-up unavailable'))
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.run(spec.id)
    await runtime.ask(spec.id, '再解释一下。')

    expect(runtime.getState(spec.id)).toMatchObject({
      followUpStatus: 'error',
      followUpError: 'follow-up unavailable',
      conversation: []
    })
  })

  it('replaces a pending follow-up without leaking its question into state or context', async () => {
    const first = deferred<GeneratedLesson>()
    const second = deferred<GeneratedLesson>()
    const signals: AbortSignal[] = []
    const base = lesson('base')
    const generate = vi
      .fn()
      .mockResolvedValueOnce(base)
      .mockImplementationOnce((_request, context) => {
        signals.push(context.signal)
        return first.promise
      })
      .mockImplementationOnce((_request, context) => {
        signals.push(context.signal)
        return second.promise
      })
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.run(spec.id)
    const firstAsk = runtime.ask(spec.id, '第一个问题')
    const secondAsk = runtime.ask(spec.id, '第二个问题')

    expect(signals[0]?.aborted).toBe(true)
    expect(runtime.getState(spec.id)).toMatchObject({
      followUpStatus: 'loading',
      conversation: []
    })
    expect(generate.mock.calls[2]?.[0].conversation).toEqual([
      { role: 'assistant', lesson: base },
      { role: 'user', content: '第二个问题' }
    ])

    first.resolve(lesson('stale answer'))
    await firstAsk
    expect(runtime.getState(spec.id).conversation).toEqual([])

    second.resolve(lesson('current answer'))
    await secondAsk
    expect(runtime.getState(spec.id).conversation).toEqual([
      { role: 'user', content: '第二个问题' },
      { role: 'assistant', lesson: lesson('current answer') }
    ])
  })

  it('keeps the prior conversation during replacement and clears it only after success', async () => {
    const replacement = deferred<GeneratedLesson>()
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson('base'))
      .mockResolvedValueOnce(lesson('answer'))
      .mockImplementationOnce(() => replacement.promise)
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.run(spec.id)
    await runtime.ask(spec.id, '为什么？')
    const refreshing = runtime.run(spec.id)

    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'loading',
      blocks: [{ type: 'paragraph', text: 'base' }],
      conversation: [
        { role: 'user', content: '为什么？' },
        { role: 'assistant', lesson: lesson('answer') }
      ]
    })

    replacement.resolve(lesson('replacement'))
    await refreshing
    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'success',
      blocks: [{ type: 'paragraph', text: 'replacement' }],
      conversation: [],
      followUpStatus: 'idle'
    })
  })

  it('ignores empty questions and questions before a successful lesson exists', async () => {
    const generate = vi.fn().mockResolvedValue(lesson('base'))
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })

    await runtime.ask(spec.id, 'not ready')
    await runtime.run(spec.id)
    await runtime.ask(spec.id, '   ')

    expect(generate).toHaveBeenCalledTimes(1)
    expect(runtime.getState(spec.id).conversation).toEqual([])
  })

  it('surfaces generation failures while preserving the registered fallback', async () => {
    const runtime = createGentorialRuntime({
      generate: vi.fn().mockRejectedValue(new Error('provider unavailable'))
    })
    runtime.register({
      generate: spec,
      concepts: [concept],
      fallback: [{ type: 'paragraph', text: 'author fallback' }]
    })

    await runtime.run(spec.id)

    expect(runtime.getState(spec.id)).toMatchObject({
      status: 'error',
      error: 'provider unavailable',
      fallback: [{ type: 'paragraph', text: 'author fallback' }]
    })
  })

  it('rejects duplicate live registrations for the same stable id', () => {
    const runtime = createGentorialRuntime({
      generate: vi.fn().mockResolvedValue(lesson('unused'))
    })
    runtime.register({ generate: spec, concepts: [concept] })

    expect(() => runtime.register({ generate: spec, concepts: [concept] })).toThrow(
      `already registered for ${spec.id}`
    )
  })
})
