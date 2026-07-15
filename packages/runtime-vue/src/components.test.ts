import type { ConceptSpec, GeneratedLesson, GenerateSpec } from '@gentorial/core'
import { createApp, type Component, type VNode } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createGentorialRuntime,
  GentorialGeneratedRegion,
  GentorialGenerateTrigger,
  GentorialPreferences,
  gentorialRuntimeKey,
  LessonBlockRenderer,
  type GentorialRuntime
} from './index.js'

const source = { file: 'content/c.md', line: 3 }
const concept: ConceptSpec = {
  id: 'history-anchor',
  statement: 'ALGOL, CPL, BCPL, B, C',
  source
}
const spec: GenerateSpec = {
  id: 'c-history',
  kind: 'explanation',
  prompt: '按时间线讲解。',
  concepts: [concept.id],
  scope: {
    type: 'section',
    id: 'history-section',
    heading: 'C 的历史',
    level: 2,
    markdown: 'ALGOL → CPL → BCPL → B → C',
    source
  },
  trigger: { type: 'heading', source },
  output: { placement: 'after-source', mode: 'replace' },
  source
}

function lesson(): GeneratedLesson {
  return {
    schemaVersion: '1',
    blocks: [{ type: 'paragraph', text: 'generated' }],
    grounding: { conceptIds: [concept.id], sourceIds: [spec.scope.id] }
  }
}

type SetupComponent = Component & {
  setup(props: Record<string, unknown>): () => VNode
}

function setupRender(
  component: Component,
  props: Record<string, unknown>,
  runtime: GentorialRuntime
): () => VNode {
  const app = createApp({ render: () => null })
  app.provide(gentorialRuntimeKey, runtime)
  return app.runWithContext(() => (component as SetupComponent).setup(props))
}

function vnodeChildren(vnode: VNode): VNode[] {
  return vnode.children as VNode[]
}

function invoke(
  vnode: VNode,
  event: 'onClick' | 'onChange' | 'onInput' | 'onKeydown',
  payload?: unknown
): void {
  const listener = vnode.props?.[event]
  if (typeof listener !== 'function') throw new Error(`${event} listener is missing`)
  listener(payload)
}

function findVNode(vnode: VNode, predicate: (candidate: VNode) => boolean): VNode | undefined {
  if (predicate(vnode)) return vnode
  if (!Array.isArray(vnode.children)) return undefined

  for (const child of vnode.children) {
    if (typeof child !== 'object' || child === null) continue
    const found = findVNode(child as VNode, predicate)
    if (found) return found
  }

  return undefined
}

function hasClass(vnode: VNode, className: string): boolean {
  const value = vnode.props?.class
  return Array.isArray(value)
    ? value.includes(className)
    : typeof value === 'string' && value.split(/\s+/u).includes(className)
}

function visibleVNodeText(vnode: VNode | null): string {
  if (!vnode) return ''
  const style = vnode.props?.style
  if (typeof style === 'object' && style?.position === 'absolute' && style?.width === '1px') {
    return ''
  }
  if (typeof vnode.children === 'string') return vnode.children
  if (!Array.isArray(vnode.children)) return ''

  return vnode.children
    .map((child) => {
      if (typeof child === 'string') return child
      return typeof child === 'object' && child !== null ? visibleVNodeText(child as VNode) : ''
    })
    .join('')
}

describe('GentorialPreferences', () => {
  it('writes detail, tone and narrative selections into the global profile', () => {
    const runtime = createGentorialRuntime({ generate: vi.fn() })
    const render = setupRender(GentorialPreferences, {}, runtime)
    const details = render()
    const deep = findVNode(
      details,
      (candidate) => candidate.props?.['data-preference-value'] === 'deep'
    )!
    const conversational = findVNode(
      details,
      (candidate) => candidate.props?.['data-preference-value'] === 'conversational'
    )!
    const timeline = findVNode(
      details,
      (candidate) => candidate.props?.['data-preference-value'] === 'timeline'
    )!

    invoke(deep, 'onClick')
    invoke(conversational, 'onClick')
    invoke(timeline, 'onClick')

    expect(runtime.learnerProfile.value).toMatchObject({
      detail: 'deep',
      tone: 'conversational',
      narrative: 'timeline'
    })
  })

  it('stores the selected BYOK model and Base URL in the runtime session', () => {
    const runtime = createGentorialRuntime({ generate: vi.fn() })
    const render = setupRender(GentorialPreferences, {}, runtime)
    const continueButton = findVNode(
      render(),
      (candidate) => candidate.props?.class === 'gentorial-preferences__primary'
    )!

    invoke(continueButton, 'onClick')
    let byok = render()
    let fields = vnodeChildren(vnodeChildren(byok)[1]!)
    const provider = vnodeChildren(fields[0]!)[1]!
    invoke(provider, 'onChange', { currentTarget: { value: 'custom' } })

    byok = render()
    fields = vnodeChildren(vnodeChildren(byok)[1]!)
    const model = vnodeChildren(fields[1]!)[1]!
    const apiKey = vnodeChildren(fields[2]!)[1]!
    const baseUrl = vnodeChildren(fields[3]!)[1]!
    invoke(apiKey, 'onInput', { currentTarget: { value: 'secret' } })
    invoke(model, 'onInput', { currentTarget: { value: 'local-model' } })
    invoke(baseUrl, 'onInput', {
      currentTarget: { value: 'https://localhost:11434/v1' }
    })

    const save = findVNode(
      render(),
      (candidate) => candidate.props?.class === 'gentorial-preferences__primary'
    )!
    expect(save.props?.disabled).toBe(false)
    invoke(save, 'onClick')

    expect(runtime.byokSession.value).toEqual({
      provider: 'custom',
      apiKey: 'secret',
      model: 'local-model',
      baseUrl: 'https://localhost:11434/v1'
    })
  })
})

describe('GentorialGenerateTrigger', () => {
  it('uses the section label and changes from generate to busy to result controls', async () => {
    let requestSignal: AbortSignal | undefined
    const generate = vi.fn(async (_request, context) => {
      requestSignal = context.signal
      return lesson()
    })
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })
    const render = setupRender(
      GentorialGenerateTrigger,
      { generateId: spec.id, label: spec.scope.heading },
      runtime
    )

    const idleRoot = render()
    const idleButton = findVNode(idleRoot, (candidate) => candidate.type === 'button')!
    expect(idleButton.props?.['aria-label']).toBe('按需展开：C 的历史')

    invoke(idleButton, 'onClick')
    const loadingButton = findVNode(render(), (candidate) => candidate.type === 'button')!
    expect(loadingButton.props?.['aria-label']).toBe('正在生成：C 的历史')

    await Promise.resolve()
    const successRoot = render()
    const successButton = findVNode(successRoot, (candidate) =>
      hasClass(candidate, 'gentorial-generate-trigger')
    )!
    expect(requestSignal?.aborted).toBe(false)
    expect(successButton.props?.['aria-label']).toBe('显示结果操作：C 的历史')
    expect(
      findVNode(successRoot, (candidate) => hasClass(candidate, 'gentorial-generation-toolbar'))
    ).toBeDefined()
  })

  it('does not restart or cancel the active request when clicked while loading', () => {
    let requestSignal: AbortSignal | undefined
    const generate = vi.fn((_request, context) => {
      requestSignal = context.signal
      return new Promise<GeneratedLesson>(() => {})
    })
    const runtime = createGentorialRuntime({ generate })
    runtime.register({ generate: spec, concepts: [concept] })
    const render = setupRender(
      GentorialGenerateTrigger,
      { generateId: spec.id, label: spec.scope.heading },
      runtime
    )

    invoke(
      findVNode(render(), (candidate) => hasClass(candidate, 'gentorial-generate-trigger'))!,
      'onClick'
    )
    invoke(
      findVNode(render(), (candidate) => hasClass(candidate, 'gentorial-generate-trigger'))!,
      'onClick'
    )

    expect(requestSignal?.aborted).toBe(false)
    expect(runtime.getState(spec.id).status).toBe('loading')
  })
})

describe('GentorialGeneratedRegion', () => {
  it('renders lesson blocks with a persistent follow-up composer', async () => {
    let resolveAnswer!: (value: GeneratedLesson) => void
    const answer = new Promise<GeneratedLesson>((resolve) => {
      resolveAnswer = resolve
    })
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson())
      .mockImplementationOnce(() => answer)
    const runtime = createGentorialRuntime({ generate })
    const render = setupRender(
      GentorialGeneratedRegion,
      { spec, concepts: [concept], fallback: [] },
      runtime
    )

    await runtime.run(spec.id)
    let region = render()
    expect(vnodeChildren(region)).toHaveLength(2)
    expect(vnodeChildren(region)[0]?.type).toBe(LessonBlockRenderer)
    expect(region.props?.onClick).toBeUndefined()
    expect(region.props?.onKeydown).toBeUndefined()
    expect(region.props?.tabindex).toBeUndefined()
    const input = findVNode(region, (candidate) => candidate.type === 'input')
    const label = findVNode(region, (candidate) => candidate.type === 'label')
    const initialSubmit = findVNode(region, (candidate) => candidate.type === 'button')
    expect(input).toBeDefined()
    expect(input?.props?.placeholder).toBe('继续追问…')
    expect(label?.props?.for).toBe(input?.props?.id)
    expect(label?.props?.style).toMatchObject({
      position: 'absolute',
      width: '1px'
    })
    expect(initialSubmit?.children).toBe('发送')
    expect(initialSubmit?.props?.disabled).toBe(true)
    expect(findVNode(region, (candidate) => candidate.type === 'form')).toBeUndefined()

    invoke(input!, 'onInput', {
      currentTarget: { value: '为什么 B 之后会出现 C？' }
    })
    region = render()
    const submit = findVNode(region, (candidate) => candidate.type === 'button')
    expect(submit?.props?.disabled).toBe(false)
    invoke(submit!, 'onClick')

    expect(runtime.getState(spec.id)).toMatchObject({
      followUpStatus: 'loading',
      conversation: []
    })
    expect(generate.mock.calls[1]?.[0].conversation).toEqual([
      { role: 'assistant', lesson: lesson() },
      { role: 'user', content: '为什么 B 之后会出现 C？' }
    ])

    region = render()
    expect(findVNode(region, (candidate) => candidate.type === 'input')?.props?.value).toBe('')
    expect(findVNode(region, (candidate) => candidate.type === 'button')?.props?.disabled).toBe(
      true
    )
    expect(visibleVNodeText(region)).not.toContain('为什么 B 之后会出现 C？')
    expect(visibleVNodeText(region)).not.toContain('生成')

    resolveAnswer({
      ...lesson(),
      blocks: [{ type: 'paragraph', text: '因为 C 延续了 B 的系统编程目标。' }]
    })
    await answer
    await vi.waitFor(() => {
      expect(runtime.getState(spec.id).conversation).toHaveLength(2)
    })

    region = render()
    const renderers = vnodeChildren(region).filter((child) => child.type === LessonBlockRenderer)
    expect(renderers).toHaveLength(2)
    expect(renderers[1]?.props?.blocks).toEqual([
      { type: 'paragraph', text: '因为 C 延续了 B 的系统编程目标。' }
    ])
    expect(findVNode(region, (candidate) => candidate.type === 'input')).toBeDefined()
    expect(visibleVNodeText(region)).toBe('发送')
  })

  it('submits with Enter and cancels a pending follow-up with Escape', async () => {
    let signal: AbortSignal | undefined
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson())
      .mockImplementationOnce((_request, context) => {
        signal = context.signal
        return new Promise<GeneratedLesson>(() => {})
      })
    const runtime = createGentorialRuntime({ generate })
    const render = setupRender(
      GentorialGeneratedRegion,
      { spec, concepts: [concept], fallback: [] },
      runtime
    )

    await runtime.run(spec.id)
    let region = render()
    invoke(
      findVNode(region, (candidate) => candidate.type === 'input')!,
      'onInput',
      {
        currentTarget: { value: '继续说明。' }
      }
    )
    invoke(
      findVNode(region, (candidate) => candidate.type === 'input')!,
      'onKeydown',
      {
        key: 'Enter',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }
    )

    region = render()
    expect(findVNode(region, (candidate) => candidate.type === 'input')).toBeDefined()
    invoke(
      findVNode(region, (candidate) => candidate.type === 'input')!,
      'onKeydown',
      {
        key: 'Escape',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }
    )

    expect(signal?.aborted).toBe(true)
    expect(runtime.getState(spec.id).followUpStatus).toBe('idle')
    expect(findVNode(render(), (candidate) => candidate.type === 'input')?.props?.value).toBe('')
  })

  it('shows follow-up failures, marks the region as failed, and keeps the input retryable', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson())
      .mockRejectedValueOnce(new Error('provider failed visibly'))
    const runtime = createGentorialRuntime({ generate })
    const render = setupRender(
      GentorialGeneratedRegion,
      { spec, concepts: [concept], fallback: [] },
      runtime
    )

    await runtime.run(spec.id)
    let region = render()
    const input = findVNode(region, (candidate) => candidate.type === 'input')
    invoke(input!, 'onInput', { currentTarget: { value: '失败的问题' } })
    invoke(input!, 'onKeydown', {
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })
    await vi.waitFor(() => {
      expect(runtime.getState(spec.id).followUpStatus).toBe('error')
    })

    region = render()
    expect(hasClass(region, 'gentorial-generated-region--error')).toBe(true)
    expect(visibleVNodeText(region)).toBe('provider failed visibly发送')
    const errorMessage = findVNode(region, (candidate) =>
      hasClass(candidate, 'gentorial-generated-region__follow-up-error')
    )
    expect(errorMessage?.props?.role).toBe('alert')
    expect(errorMessage?.props?.['aria-live']).toBe('assertive')

    const retryInput = findVNode(render(), (candidate) => candidate.type === 'input')
    expect(retryInput?.props?.['aria-invalid']).toBe('true')
  })

  it('renders an accessible error region after an initial failure', async () => {
    let reject!: (reason?: unknown) => void
    const pending = new Promise<GeneratedLesson>((_resolve, rejectPromise) => {
      reject = rejectPromise
    })
    const runtime = createGentorialRuntime({ generate: vi.fn(() => pending) })
    const render = setupRender(
      GentorialGeneratedRegion,
      {
        spec,
        concepts: [concept],
        fallback: [{ type: 'paragraph', text: 'author fallback' }]
      },
      runtime
    )

    const running = runtime.run(spec.id)
    expect(render()).toBeNull()
    reject(new Error('initial request failed'))
    await running
    expect(runtime.getState(spec.id).fallback).toHaveLength(1)
    const errorRegion = render()
    expect(errorRegion).not.toBeNull()
    expect(hasClass(errorRegion!, 'gentorial-generated-region--error')).toBe(true)
    expect(errorRegion?.props?.['data-expanded']).toBe('true')
    expect(errorRegion?.props?.['aria-label']).toBe('AI 生成失败')
    const errorMessage = findVNode(errorRegion!, (candidate) =>
      hasClass(candidate, 'gentorial-generated-region__error')
    )
    expect(errorMessage?.children).toBe('initial request failed')
    expect(errorMessage?.props?.role).toBe('alert')
    expect(findVNode(errorRegion!, (candidate) => candidate.type === 'input')).toBeUndefined()
  })

  it('clears the persistent follow-up input when the main result starts refreshing', async () => {
    let resolveReplacement!: (value: GeneratedLesson) => void
    const replacement = new Promise<GeneratedLesson>((resolve) => {
      resolveReplacement = resolve
    })
    const generate = vi
      .fn()
      .mockResolvedValueOnce(lesson())
      .mockImplementationOnce(() => replacement)
    const runtime = createGentorialRuntime({ generate })
    const render = setupRender(
      GentorialGeneratedRegion,
      { spec, concepts: [concept], fallback: [] },
      runtime
    )

    await runtime.run(spec.id)
    let region = render()
    const input = findVNode(region, (candidate) => candidate.type === 'input')
    invoke(input!, 'onInput', { currentTarget: { value: '尚未提交的问题' } })
    expect(findVNode(render(), (candidate) => candidate.type === 'input')?.props?.value).toBe(
      '尚未提交的问题'
    )

    const refreshing = runtime.run(spec.id)
    region = render()
    expect(findVNode(region, (candidate) => candidate.type === 'input')?.props?.value).toBe('')
    expect(findVNode(region, (candidate) => candidate.type === 'button')?.props?.disabled).toBe(
      true
    )

    resolveReplacement(lesson('replacement'))
    await refreshing
    expect(findVNode(render(), (candidate) => candidate.type === 'input')).toBeDefined()
  })
})
