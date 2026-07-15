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

export type GentorialGenerationState = {
  readonly id: string
  readonly status: GentorialGenerationStatus
  readonly markdown: string | undefined
  readonly blocks: readonly LessonBlock[]
  readonly fallback: readonly LessonBlock[]
  readonly error: string | undefined
  readonly conversation: readonly LessonConversationTurn[]
  readonly followUpStatus: GentorialFollowUpStatus
  readonly followUpError: string | undefined
  readonly streamingFollowUpBlocks: readonly LessonBlock[]
  readonly streamingFollowUpMarkdown: string | undefined
  readonly expanded: boolean
}

export type GentorialRuntimeOptions = {
  learnerProfile?: LearnerProfile
  byokSession?: GentorialByokSession
  generate(
    request: RuntimeGenerationRequest,
    context: RuntimeGenerationContext
  ): GeneratedLesson | AsyncIterable<string> | Promise<GeneratedLesson | AsyncIterable<string>>
}

export type GentorialRuntime = Plugin & {
  readonly generate: GentorialRuntimeOptions['generate']
  readonly learnerProfile: Ref<LearnerProfile>
  readonly byokSession: Ref<GentorialByokSession | undefined>
  register(registration: GentorialRegistration): () => void
  getState(id: string): GentorialGenerationState
  run(id: string): Promise<void>
  cancel(id: string): void
  ask(id: string, question: string): Promise<void>
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
    followUpStatus: 'idle' as const,
    followUpError: undefined,
    streamingFollowUpBlocks: [],
    streamingFollowUpMarkdown: undefined,
    expanded: false,
    baseLesson: undefined
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
    states.set(id, state)
    return state
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
      state.followUpStatus = 'idle'
      state.followUpError = undefined
      state.streamingFollowUpBlocks = []
      state.streamingFollowUpMarkdown = undefined
      state.status = 'success'
      state.expanded = true
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
    const userTurn: LessonConversationTurn = { role: 'user', content }
    const conversation: LessonConversationTurn[] = [
      { role: 'assistant', lesson: state.baseLesson },
      ...state.conversation,
      userTurn
    ]

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
      state.conversation = [
        ...state.conversation,
        userTurn,
        { role: 'assistant', lesson }
      ]
      state.streamingFollowUpBlocks = []
      state.streamingFollowUpMarkdown = undefined
      state.followUpStatus = 'idle'
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
      return readonly(mutableState(id)) as GentorialGenerationState
    },
    run,
    cancel,
    ask,
    cancelFollowUp,
    setExpanded(id, expanded) {
      mutableState(id).expanded = expanded
    },
    setLearnerProfile(profile) {
      learnerProfile.value = { ...profile }
    },
    setByokSession(session) {
      byokSession.value = session ? { ...session } : undefined
    },
    install(app: App) {
      app.provide(gentorialRuntimeKey, runtime)
    }
  }

  return runtime
}
