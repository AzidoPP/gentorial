import type {
  ConceptSpec,
  GeneratedLesson,
  GenerateSpec,
  LearnerProfile,
  LessonConversationTurn,
  LessonBlock
} from '@gentorial/core'
import {
  reactive,
  readonly,
  ref,
  type App,
  type InjectionKey,
  type Plugin,
  type Ref
} from 'vue'

export type RuntimeGenerationRequest = {
  generate: GenerateSpec
  concepts: ConceptSpec[]
  learner?: LearnerProfile
  conversation?: LessonConversationTurn[]
}

export type RuntimeGenerationContext = {
  signal: AbortSignal
  byok?: GentorialByokSession
}

export type GentorialByokSession = {
  provider: string
  apiKey: string
  model?: string
  baseUrl?: string
  /** @deprecated Use baseUrl. */
  endpoint?: string
}

export type GentorialRegistration = RuntimeGenerationRequest & {
  fallback?: LessonBlock[]
}

export type GentorialGenerationStatus = 'idle' | 'loading' | 'success' | 'error'
export type GentorialFollowUpStatus = 'idle' | 'loading' | 'error'

export type GentorialConversationNode = {
  readonly id: string
  readonly parentId?: string
  readonly question?: string
  readonly lesson: GeneratedLesson
  readonly createdAt: number
}

export type GentorialGenerationState = {
  readonly id: string
  readonly status: GentorialGenerationStatus
  readonly markdown: string | undefined
  readonly blocks: readonly LessonBlock[]
  readonly fallback: readonly LessonBlock[]
  readonly error: string | undefined
  readonly conversation: readonly LessonConversationTurn[]
  readonly conversationNodes: readonly GentorialConversationNode[]
  readonly rootConversationNodeId: string | undefined
  readonly activeConversationNodeId: string | undefined
  readonly followUpStatus: GentorialFollowUpStatus
  readonly followUpError: string | undefined
  readonly streamingFollowUpBlocks: readonly LessonBlock[]
  readonly streamingFollowUpMarkdown: string | undefined
  readonly expanded: boolean
}

export type GentorialRuntimeOptions = {
  learnerProfile?: LearnerProfile
  byokSession?: GentorialByokSession
  persistence?: GentorialPersistenceOptions
  /** Set to false to disable the browser-side guard. Managed servers enforce their own limits. */
  contextBudget?: GentorialContextBudget | false
  allowUnsafeHtml?: boolean
  generate(
    request: RuntimeGenerationRequest,
    context: RuntimeGenerationContext
  ): GeneratedLesson | AsyncIterable<string> | Promise<GeneratedLesson | AsyncIterable<string>>
}

export type GentorialStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type GentorialPersistenceOptions = {
  key: string
  storage?: GentorialStorage
  persistApiKey?: boolean
}

export type GentorialContextBudget = {
  /** Maximum serialized characters in the full root-to-active-node conversation. */
  maxCharacters?: number
  /** Maximum completed follow-ups on the active path. */
  maxFollowUps?: number
}

export type GentorialRuntime = Plugin & {
  readonly generate: GentorialRuntimeOptions['generate']
  readonly learnerProfile: Ref<LearnerProfile>
  readonly byokSession: Ref<GentorialByokSession | undefined>
  readonly persistence: {
    readonly enabled: boolean
    readonly persistApiKey: boolean
  }
  readonly allowUnsafeHtml: boolean
  register(registration: GentorialRegistration): () => void
  getState(id: string): GentorialGenerationState
  run(id: string): Promise<void>
  cancel(id: string): void
  ask(id: string, question: string): Promise<void>
  selectConversationNode(id: string, nodeId: string): void
  cancelFollowUp(id: string): void
  setExpanded(id: string, expanded: boolean): void
  setLearnerProfile(profile: LearnerProfile): void
  setByokSession(session: GentorialByokSession | undefined): void
}

type MutableGenerationState = {
  id: string
  status: GentorialGenerationStatus
  markdown: string | undefined
  blocks: LessonBlock[]
  fallback: LessonBlock[]
  error: string | undefined
  conversation: LessonConversationTurn[]
  conversationNodes: GentorialConversationNode[]
  rootConversationNodeId: string | undefined
  activeConversationNodeId: string | undefined
  followUpStatus: GentorialFollowUpStatus
  followUpError: string | undefined
  streamingFollowUpBlocks: LessonBlock[]
  streamingFollowUpMarkdown: string | undefined
  expanded: boolean
  baseLesson: GeneratedLesson | undefined
}

type ActiveRegistration = {
  token: symbol
  value: GentorialRegistration
}

type ActiveRequest = {
  controller: AbortController
  sequence: number
  previousBlocks?: LessonBlock[]
  previousMarkdown?: string | undefined
  previousExpanded?: boolean
}

type PersistedGenerationState = {
  markdown?: string
  blocks: LessonBlock[]
  conversation: LessonConversationTurn[]
  conversationNodes: GentorialConversationNode[]
  rootConversationNodeId: string
  activeConversationNodeId: string
  expanded: boolean
  baseLesson: GeneratedLesson
}

const defaultLearnerProfile: LearnerProfile = {
  detail: 'balanced',
  tone: 'neutral',
  narrative: 'direct'
}

export const gentorialRuntimeKey: InjectionKey<GentorialRuntime> = Symbol('gentorial-runtime')

function createState(id: string): MutableGenerationState {
  return reactive({
    id,
    status: 'idle' as const,
    markdown: undefined,
    blocks: [],
    fallback: [],
    error: undefined,
    conversation: [],
    conversationNodes: [],
    rootConversationNodeId: undefined,
    activeConversationNodeId: undefined,
    followUpStatus: 'idle' as const,
    followUpError: undefined,
    streamingFollowUpBlocks: [],
    streamingFollowUpMarkdown: undefined,
    expanded: false,
    baseLesson: undefined
  })
}

function rootNodeId(id: string): string {
  return `${id}:root`
}

function conversationForNode(
  nodes: readonly GentorialConversationNode[],
  nodeId: string | undefined
): LessonConversationTurn[] {
  if (!nodeId) return []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const path: GentorialConversationNode[] = []
  const visited = new Set<string>()
  let current = byId.get(nodeId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  return path.flatMap((node) =>
    node.parentId && node.question
      ? [
          { role: 'user', content: node.question } as const,
          { role: 'assistant', lesson: node.lesson } as const
        ]
      : []
  )
}

function treeFromLinearConversation(
  id: string,
  baseLesson: GeneratedLesson,
  conversation: readonly LessonConversationTurn[]
): {
  nodes: GentorialConversationNode[]
  rootId: string
  activeId: string
} {
  const rootId = rootNodeId(id)
  const nodes: GentorialConversationNode[] = [
    { id: rootId, lesson: baseLesson, createdAt: 0 }
  ]
  let parentId = rootId
  let question: string | undefined
  let sequence = 0

  for (const turn of conversation) {
    if (turn.role === 'user') {
      question = turn.content
    } else if (question) {
      const nodeId = `${id}:node:${++sequence}`
      nodes.push({
        id: nodeId,
        parentId,
        question,
        lesson: turn.lesson,
        createdAt: sequence
      })
      parentId = nodeId
      question = undefined
    }
  }

  return { nodes, rootId, activeId: parentId }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizedLimit(value: number | undefined, fallback: number, minimum = 1): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.floor(value))
    : fallback
}

function isAsyncIterable(value: unknown): value is AsyncIterable<string> {
  return value !== null
    && typeof value === 'object'
    && Symbol.asyncIterator in value
}

async function receiveStream(
  value: AsyncIterable<string>,
  request: RuntimeGenerationRequest,
  onText: (text: string) => void
): Promise<GeneratedLesson> {
  let text = ''
  for await (const chunk of value) {
    text += chunk
    onText(text)
  }
  if (!text) throw new Error('提供方返回了空响应流')

  return {
    schemaVersion: '1',
    markdown: text,
    blocks: [{ type: 'paragraph', text }],
    grounding: {
      conceptIds: [...request.generate.concepts],
      sourceIds: [request.generate.scope.id]
    }
  }
}

export function createGentorialRuntime(options: GentorialRuntimeOptions): GentorialRuntime {
  const states = reactive(new Map<string, MutableGenerationState>())
  const registrations = new Map<string, ActiveRegistration>()
  const requests = new Map<string, ActiveRequest>()
  const sequences = new Map<string, number>()
  const followUpRequests = new Map<string, ActiveRequest>()
  const followUpSequences = new Map<string, number>()
  const learnerProfile = ref<LearnerProfile>({
    ...defaultLearnerProfile,
    ...options.learnerProfile
  })
  const byokSession = ref<GentorialByokSession | undefined>(
    options.byokSession ? { ...options.byokSession } : undefined
  )
  const persistence = options.persistence
  const persistedGenerations = new Map<string, PersistedGenerationState>()
  let persistentStorage: GentorialStorage | undefined
  const contextBudget = options.contextBudget === false
    ? undefined
    : {
        maxCharacters: normalizedLimit(options.contextBudget?.maxCharacters, 120_000),
        maxFollowUps: normalizedLimit(options.contextBudget?.maxFollowUps, 20, 0)
      }

  function resolvePersistentStorage(): GentorialStorage | undefined {
    if (!persistence) return undefined
    if (persistence.storage) return persistence.storage
    if (typeof window === 'undefined') return undefined
    return window.localStorage
  }

  function restorePreferences(): void {
    const storage = resolvePersistentStorage()
    if (!storage || !persistence) return
    persistentStorage = storage

    try {
      const raw = storage.getItem(persistence.key)
      if (!raw) return
      const saved = JSON.parse(raw) as {
        schemaVersion?: unknown
        learnerProfile?: unknown
        byokSession?: unknown
        generations?: unknown
      }
      if (saved.schemaVersion !== '1') return
      if (saved.learnerProfile && typeof saved.learnerProfile === 'object') {
        learnerProfile.value = {
          ...defaultLearnerProfile,
          ...(saved.learnerProfile as LearnerProfile)
        }
      }
      if (
        persistence.persistApiKey &&
        saved.byokSession &&
        typeof saved.byokSession === 'object' &&
        typeof Reflect.get(saved.byokSession, 'provider') === 'string' &&
        typeof Reflect.get(saved.byokSession, 'apiKey') === 'string'
      ) {
        byokSession.value = { ...(saved.byokSession as GentorialByokSession) }
      }
      if (saved.generations && typeof saved.generations === 'object') {
        for (const [id, candidate] of Object.entries(saved.generations)) {
          if (!candidate || typeof candidate !== 'object') continue
          const baseLesson = Reflect.get(candidate, 'baseLesson')
          const blocks = Reflect.get(candidate, 'blocks')
          const conversation = Reflect.get(candidate, 'conversation')
          const conversationNodes = Reflect.get(candidate, 'conversationNodes')
          const rootConversationNodeId = Reflect.get(candidate, 'rootConversationNodeId')
          const activeConversationNodeId = Reflect.get(candidate, 'activeConversationNodeId')
          const expanded = Reflect.get(candidate, 'expanded')
          const markdown = Reflect.get(candidate, 'markdown')
          if (
            !baseLesson || typeof baseLesson !== 'object'
            || !Array.isArray(blocks)
            || !Array.isArray(conversation)
            || typeof expanded !== 'boolean'
            || (markdown !== undefined && typeof markdown !== 'string')
          ) continue
          persistedGenerations.set(id, {
            ...(typeof markdown === 'string' ? { markdown } : {}),
            blocks: blocks as LessonBlock[],
            conversation: conversation as LessonConversationTurn[],
            conversationNodes: Array.isArray(conversationNodes)
              ? conversationNodes as GentorialConversationNode[]
              : [],
            rootConversationNodeId:
              typeof rootConversationNodeId === 'string'
                ? rootConversationNodeId
                : rootNodeId(id),
            activeConversationNodeId:
              typeof activeConversationNodeId === 'string'
                ? activeConversationNodeId
                : rootNodeId(id),
            expanded,
            baseLesson: baseLesson as GeneratedLesson
          })
        }
      }
    } catch {
      storage.removeItem(persistence.key)
    }
  }

  function persistRuntimeState(): void {
    if (!persistence) return
    const storage = persistentStorage ?? resolvePersistentStorage()
    if (!storage) return
    persistentStorage = storage

    try {
      storage.setItem(
        persistence.key,
        JSON.stringify({
          schemaVersion: '1',
          learnerProfile: learnerProfile.value,
          generations: Object.fromEntries(persistedGenerations),
          ...(persistence.persistApiKey && byokSession.value
            ? { byokSession: byokSession.value }
            : {})
        })
      )
    } catch {
      // Storage can be unavailable in privacy modes; runtime preferences still work in memory.
    }
  }

  restorePreferences()

  function generationContext(signal: AbortSignal): RuntimeGenerationContext {
    return {
      signal,
      ...(byokSession.value ? { byok: { ...byokSession.value } } : {})
    }
  }

  function mutableState(id: string): MutableGenerationState {
    const current = states.get(id)
    if (current) return current

    const state = createState(id)
    const saved = persistedGenerations.get(id)
    if (saved) {
      const restoredTree = saved.conversationNodes.length > 0
        ? {
            nodes: saved.conversationNodes,
            rootId: saved.rootConversationNodeId,
            activeId: saved.activeConversationNodeId
          }
        : treeFromLinearConversation(id, saved.baseLesson, saved.conversation)
      state.status = 'success'
      state.markdown = saved.markdown
      state.blocks = [...saved.blocks]
      state.conversationNodes = [...restoredTree.nodes]
      state.rootConversationNodeId = restoredTree.rootId
      state.activeConversationNodeId = restoredTree.activeId
      state.conversation = conversationForNode(restoredTree.nodes, restoredTree.activeId)
      state.expanded = saved.expanded
      state.baseLesson = saved.baseLesson
    }
    states.set(id, state)
    return state
  }

  function persistGeneration(id: string, state: MutableGenerationState): void {
    if (!persistence) return
    if (
      !state.baseLesson
      || state.status !== 'success'
      || !state.rootConversationNodeId
      || !state.activeConversationNodeId
    ) return
    persistedGenerations.set(id, {
      ...(state.markdown !== undefined ? { markdown: state.markdown } : {}),
      blocks: [...state.blocks],
      conversation: [...state.conversation],
      conversationNodes: state.conversationNodes.map((node) => ({ ...node })),
      rootConversationNodeId: state.rootConversationNodeId,
      activeConversationNodeId: state.activeConversationNodeId,
      expanded: state.expanded,
      baseLesson: state.baseLesson
    })
    persistRuntimeState()
  }

  function nextSequence(id: string): number {
    const sequence = (sequences.get(id) ?? 0) + 1
    sequences.set(id, sequence)
    return sequence
  }

  function nextFollowUpSequence(id: string): number {
    const sequence = (followUpSequences.get(id) ?? 0) + 1
    followUpSequences.set(id, sequence)
    return sequence
  }

  function cancel(id: string): void {
    const active = requests.get(id)
    if (!active) return

    requests.delete(id)
    nextSequence(id)
    active.controller.abort()

    const state = mutableState(id)
    if (active.previousBlocks) state.blocks = active.previousBlocks
    state.markdown = active.previousMarkdown
    if (active.previousExpanded !== undefined) state.expanded = active.previousExpanded
    state.error = undefined
    state.status = state.blocks.length > 0 ? 'success' : 'idle'
  }

  function cancelFollowUp(id: string): void {
    const active = followUpRequests.get(id)
    if (!active) return

    followUpRequests.delete(id)
    nextFollowUpSequence(id)
    active.controller.abort()

    const state = mutableState(id)
    state.followUpStatus = 'idle'
    state.followUpError = undefined
    state.streamingFollowUpBlocks = []
    state.streamingFollowUpMarkdown = undefined
  }

  async function run(id: string): Promise<void> {
    const registration = registrations.get(id)?.value
    const state = mutableState(id)

    if (!registration) {
      state.status = 'error'
      state.error = `No Gentorial generation region is registered for ${id}`
      return
    }

    cancel(id)
    const sequence = nextSequence(id)
    const controller = new AbortController()
    requests.set(id, {
      controller,
      sequence,
      previousBlocks: [...state.blocks],
      previousMarkdown: state.markdown,
      previousExpanded: state.expanded
    })
    state.status = 'loading'
    state.error = undefined

    const selectedLearner = registration.learner ?? learnerProfile.value
    const request: RuntimeGenerationRequest = {
      generate: registration.generate,
      concepts: registration.concepts,
      learner: { ...selectedLearner }
    }

    try {
      const output = options.generate(request, generationContext(controller.signal))
      const value = isAsyncIterable(output) ? output : await output
      const lesson = isAsyncIterable(value)
        ? await receiveStream(value, request, (text) => {
          const active = requests.get(id)
          if (!active || active.sequence !== sequence || controller.signal.aborted) return
          state.markdown = text
          state.blocks = [{ type: 'paragraph', text }]
          state.expanded = true
        })
        : value
      const active = requests.get(id)
      if (!active || active.sequence !== sequence || controller.signal.aborted) return

      requests.delete(id)
      cancelFollowUp(id)
      state.baseLesson = lesson
      state.markdown = lesson.markdown
      state.blocks = [...lesson.blocks]
      state.conversation = []
      const rootId = rootNodeId(id)
      state.conversationNodes = [{ id: rootId, lesson, createdAt: Date.now() }]
      state.rootConversationNodeId = rootId
      state.activeConversationNodeId = rootId
      state.followUpStatus = 'idle'
      state.followUpError = undefined
      state.streamingFollowUpBlocks = []
      state.streamingFollowUpMarkdown = undefined
      state.status = 'success'
      state.expanded = true
      persistGeneration(id, state)
    } catch (error) {
      const active = requests.get(id)
      if (!active || active.sequence !== sequence) return

      requests.delete(id)
      if (controller.signal.aborted) {
        state.status = state.blocks.length > 0 ? 'success' : 'idle'
        return
      }

      if (active.previousBlocks) state.blocks = active.previousBlocks
      state.markdown = active.previousMarkdown
      if (active.previousExpanded !== undefined) state.expanded = active.previousExpanded
      state.error = errorMessage(error)
      state.status = 'error'
    }
  }

  async function ask(id: string, question: string): Promise<void> {
    const registration = registrations.get(id)?.value
    const state = mutableState(id)
    const content = question.trim()

    if (!registration || !state.baseLesson || content.length === 0) return

    cancelFollowUp(id)
    const sequence = nextFollowUpSequence(id)
    const controller = new AbortController()
    const parentId = state.activeConversationNodeId
    if (!parentId) return
    const userTurn: LessonConversationTurn = { role: 'user', content }
    const conversation: LessonConversationTurn[] = [
      { role: 'assistant', lesson: state.baseLesson },
      ...state.conversation,
      userTurn
    ]

    if (contextBudget) {
      const followUps = conversation.filter((turn) => turn.role === 'user').length
      const characters = JSON.stringify(conversation).length
      const violation = followUps > contextBudget.maxFollowUps
        ? `当前学习路径最多允许 ${contextBudget.maxFollowUps} 次追问`
        : characters > contextBudget.maxCharacters
          ? `当前学习路径上下文超过 ${contextBudget.maxCharacters} 个字符的限制`
          : undefined
      if (violation) {
        state.followUpStatus = 'error'
        state.followUpError = violation
        state.streamingFollowUpBlocks = []
        state.streamingFollowUpMarkdown = undefined
        return
      }
    }

    followUpRequests.set(id, { controller, sequence })
    state.followUpStatus = 'loading'
    state.followUpError = undefined
    state.streamingFollowUpBlocks = []
    state.streamingFollowUpMarkdown = undefined

    const selectedLearner = registration.learner ?? learnerProfile.value
    const request: RuntimeGenerationRequest = {
      generate: registration.generate,
      concepts: registration.concepts,
      learner: { ...selectedLearner },
      conversation
    }

    try {
      const output = options.generate(request, generationContext(controller.signal))
      const value = isAsyncIterable(output) ? output : await output
      const lesson = isAsyncIterable(value)
        ? await receiveStream(value, request, (text) => {
          const active = followUpRequests.get(id)
          if (!active || active.sequence !== sequence || controller.signal.aborted) return
          state.streamingFollowUpMarkdown = text
          state.streamingFollowUpBlocks = [{ type: 'paragraph', text }]
        })
        : value
      const active = followUpRequests.get(id)
      if (!active || active.sequence !== sequence || controller.signal.aborted) return

      followUpRequests.delete(id)
      let nodeSequence = state.conversationNodes.length
      let nodeId = `${id}:node:${nodeSequence}`
      while (state.conversationNodes.some((node) => node.id === nodeId)) {
        nodeId = `${id}:node:${++nodeSequence}`
      }
      state.conversationNodes = [
        ...state.conversationNodes,
        {
          id: nodeId,
          parentId,
          question: content,
          lesson,
          createdAt: Date.now()
        }
      ]
      state.activeConversationNodeId = nodeId
      state.conversation = conversationForNode(state.conversationNodes, nodeId)
      state.streamingFollowUpBlocks = []
      state.streamingFollowUpMarkdown = undefined
      state.followUpStatus = 'idle'
      persistGeneration(id, state)
    } catch (error) {
      const active = followUpRequests.get(id)
      if (!active || active.sequence !== sequence) return

      followUpRequests.delete(id)
      if (controller.signal.aborted) {
        state.streamingFollowUpBlocks = []
        state.streamingFollowUpMarkdown = undefined
        state.followUpStatus = 'idle'
        return
      }

      state.followUpStatus = 'error'
      state.followUpError = errorMessage(error)
      state.streamingFollowUpBlocks = []
      state.streamingFollowUpMarkdown = undefined
    }
  }

  const runtime: GentorialRuntime = {
    generate: options.generate,
    learnerProfile,
    byokSession,
    persistence: {
      enabled: Boolean(persistence),
      persistApiKey: Boolean(persistence?.persistApiKey)
    },
    allowUnsafeHtml: options.allowUnsafeHtml === true,
    register(registration) {
      const id = registration.generate.id
      if (registrations.has(id)) {
        throw new Error(`A Gentorial generation region is already registered for ${id}`)
      }

      const token = Symbol(id)
      const state = mutableState(id)
      state.fallback = [...(registration.fallback ?? [])]
      registrations.set(id, { token, value: registration })

      return () => {
        if (registrations.get(id)?.token !== token) return
        cancel(id)
        cancelFollowUp(id)
        registrations.delete(id)
        states.delete(id)
        sequences.delete(id)
        followUpSequences.delete(id)
      }
    },
    getState(id) {
      return readonly(mutableState(id)) as unknown as GentorialGenerationState
    },
    run,
    cancel,
    ask,
    selectConversationNode(id, nodeId) {
      const state = mutableState(id)
      if (!state.conversationNodes.some((node) => node.id === nodeId)) return

      cancelFollowUp(id)
      state.activeConversationNodeId = nodeId
      state.conversation = conversationForNode(state.conversationNodes, nodeId)
      state.followUpError = undefined
      persistGeneration(id, state)
    },
    cancelFollowUp,
    setExpanded(id, expanded) {
      const state = mutableState(id)
      state.expanded = expanded
      persistGeneration(id, state)
    },
    setLearnerProfile(profile) {
      learnerProfile.value = { ...profile }
      persistRuntimeState()
    },
    setByokSession(session) {
      byokSession.value = session ? { ...session } : undefined
      persistRuntimeState()
    },
    install(app: App) {
      if (!persistentStorage) restorePreferences()
      app.provide(gentorialRuntimeKey, runtime)
    }
  }

  return runtime
}
