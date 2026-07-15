import type { ConceptSpec, GenerateSpec, LearnerProfile, LessonBlock } from '@gentorial/core'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  FileCode,
  ListTree,
  Maximize2,
  Minimize2,
  RefreshCw,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp
} from '@lucide/vue'
import {
  computed,
  defineComponent,
  h,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  watch,
  type Component,
  type PropType,
  type VNode,
  type VNodeChild
} from 'vue'
import {
  gentorialRuntimeKey,
  type GentorialConversationNode,
  type GentorialGenerationStatus
} from './runtime.js'
import { gentorialMarkdownAsText, renderGentorialMarkdown } from './markdown.js'

export const GentorialMarkdownRenderer = defineComponent({
  name: 'GentorialMarkdownRenderer',
  props: {
    source: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const runtime = inject(gentorialRuntimeKey, undefined)
    return () =>
      h(
        'div',
        { class: 'gentorial-markdown' },
        renderGentorialMarkdown(props.source, {
          allowUnsafeHtml: runtime?.allowUnsafeHtml === true
        })
      )
  }
})

function renderBlock(block: LessonBlock, key: number): VNodeChild {
  switch (block.type) {
    case 'paragraph':
      return h('p', { key }, block.text)
    case 'heading':
      return h(`h${block.level}`, { key }, block.text)
    case 'list':
      return h(
        block.ordered ? 'ol' : 'ul',
        { key },
        block.items.map((item, itemIndex) => h('li', { key: itemIndex }, item))
      )
    case 'code':
      return h('figure', { key, class: 'gentorial-code' }, [
        ...(block.caption ? [h('figcaption', block.caption)] : []),
        h('pre', [
          h(
            'code',
            {
              class: block.language ? `language-${block.language}` : undefined
            },
            block.code
          )
        ])
      ])
    case 'callout':
      return h(
        'aside',
        {
          key,
          class: ['gentorial-callout', `gentorial-callout--${block.tone}`],
          role: block.tone === 'danger' ? 'alert' : 'note'
        },
        [...(block.title ? [h('strong', block.title)] : []), h('p', block.text)]
      )
    case 'comparison':
      return h('div', { key, class: 'gentorial-comparison' }, [
        h('section', [
          h('h4', block.left.title),
          h(
            'ul',
            block.left.items.map((item, index) => h('li', { key: index }, item))
          )
        ]),
        h('section', [
          h('h4', block.right.title),
          h(
            'ul',
            block.right.items.map((item, index) => h('li', { key: index }, item))
          )
        ])
      ])
  }
}

export const LessonBlockRenderer = defineComponent({
  name: 'LessonBlockRenderer',
  props: {
    markdown: {
      type: String,
      required: false
    },
    blocks: {
      type: Array as PropType<readonly LessonBlock[]>,
      required: true
    }
  },
  setup(props) {
    return () =>
      props.markdown
        ? h(GentorialMarkdownRenderer, { source: props.markdown })
        : h('div', { class: 'gentorial-lesson-blocks' }, props.blocks.map(renderBlock))
  }
})

export const GentorialConcept = defineComponent({
  name: 'GentorialConcept',
  props: {
    concept: {
      type: Object as PropType<ConceptSpec>,
      required: true
    }
  },
  setup(props) {
    return () =>
      h('section', { class: 'gentorial-concept', 'data-concept-id': props.concept.id }, [
        ...(props.concept.title ? [h('h3', props.concept.title)] : []),
        h('p', props.concept.statement)
      ])
  }
})

function triggerText(status: GentorialGenerationStatus, subject: string): string {
  if (status === 'loading') {
    return `正在生成：${subject}`
  }
  if (status === 'success') {
    return `显示结果操作：${subject}`
  }
  if (status === 'error') {
    return `重试展开：${subject}`
  }
  return `按需展开：${subject}`
}

function blocksAsText(blocks: readonly LessonBlock[], markdown: boolean): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return block.text
        case 'heading':
          return markdown ? `${'#'.repeat(block.level)} ${block.text}` : block.text
        case 'list':
          return block.items
            .map((item, index) =>
              markdown ? `${block.ordered ? `${index + 1}.` : '-'} ${item}` : item
            )
            .join('\n')
        case 'code':
          return markdown
            ? `${block.caption ? `${block.caption}\n\n` : ''}\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``
            : `${block.caption ? `${block.caption}\n` : ''}${block.code}`
        case 'callout':
          return [block.title, block.text].filter(Boolean).join('\n')
        case 'comparison':
          return [block.left, block.right]
            .map(
              (side) =>
                `${side.title}\n${side.items.map((item) => (markdown ? `- ${item}` : item)).join('\n')}`
            )
            .join('\n\n')
      }
    })
    .join('\n\n')
}

type ControlIcon =
  | 'regenerate'
  | 'copy'
  | 'markdown'
  | 'up'
  | 'down'
  | 'expand'
  | 'collapse'
  | 'preferences'
  | 'arrow-left'
  | 'arrow-right'
  | 'check'

function controlIcon(icon: ControlIcon): VNode {
  const icons: Record<ControlIcon, Component> = {
    regenerate: RefreshCw,
    copy: Copy,
    markdown: FileCode,
    up: ThumbsUp,
    down: ThumbsDown,
    expand: Maximize2,
    collapse: Minimize2,
    preferences: SlidersHorizontal,
    'arrow-left': ArrowLeft,
    'arrow-right': ArrowRight,
    check: Check
  }
  return h(icons[icon], {
    size: 16,
    strokeWidth: 1.75,
    'aria-hidden': 'true'
  })
}

export const GentorialGenerateTrigger = defineComponent({
  name: 'GentorialGenerateTrigger',
  props: {
    generateId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: false
    }
  },
  setup(props) {
    const runtime = inject(gentorialRuntimeKey, undefined)
    const state = computed(() => runtime?.getState(props.generateId))
    const feedback = ref<'up' | 'down' | undefined>()
    const copied = ref<'text' | 'markdown' | undefined>()
    const primaryRotation = ref(0)
    const secondaryRotation = ref(0)
    let primarySpeed = 62
    let secondarySpeed = -43
    let transitionStarted = 0
    let primaryStart = primarySpeed
    let secondaryStart = secondarySpeed
    let primaryTarget = primarySpeed
    let secondaryTarget = secondarySpeed
    let frame = 0
    let lastFrame = 0

    watch(
      () => state.value?.status,
      (status) => {
        transitionStarted = typeof performance === 'undefined' ? 0 : performance.now()
        primaryStart = primarySpeed
        secondaryStart = secondarySpeed
        primaryTarget = status === 'loading' ? 620 : 62
        secondaryTarget = status === 'loading' ? -430 : -43
      }
    )

    onMounted(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const tick = (time: number) => {
        const delta = lastFrame ? Math.min(time - lastFrame, 64) : 0
        lastFrame = time
        const progress = Math.min(Math.max((time - transitionStarted) / 1000, 0), 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        primarySpeed = primaryStart + (primaryTarget - primaryStart) * eased
        secondarySpeed = secondaryStart + (secondaryTarget - secondaryStart) * eased
        primaryRotation.value = (primaryRotation.value + (primarySpeed * delta) / 1000) % 360
        secondaryRotation.value = (secondaryRotation.value + (secondarySpeed * delta) / 1000) % 360
        frame = window.requestAnimationFrame(tick)
      }
      transitionStarted = performance.now() - 1000
      frame = window.requestAnimationFrame(tick)
    })
    onBeforeUnmount(() => window.cancelAnimationFrame(frame))

    function activate(): void {
      if (!runtime) return
      if (state.value?.status === 'loading' || state.value?.status === 'success') return
      void runtime.run(props.generateId)
    }

    async function copy(format: 'text' | 'markdown'): Promise<void> {
      if (!state.value || typeof navigator === 'undefined' || !navigator.clipboard) return
      const sources = [
        state.value.markdown ?? blocksAsText(state.value.blocks, true),
        ...state.value.conversation.flatMap((turn) =>
          turn.role === 'assistant'
            ? [turn.lesson.markdown ?? blocksAsText(turn.lesson.blocks, true)]
            : []
        )
      ]
      const markdown = sources.filter(Boolean).join('\n\n')
      await navigator.clipboard.writeText(
        format === 'markdown' ? markdown : gentorialMarkdownAsText(markdown)
      )
      copied.value = format
      window.setTimeout(() => {
        copied.value = undefined
      }, 1200)
    }

    function control(label: string, icon: ControlIcon, action: () => void, active = false): VNode {
      return h(
        'button',
        {
          type: 'button',
          class: 'gentorial-generation-toolbar__button',
          title: label,
          'aria-label': label,
          'aria-pressed': active || undefined,
          onClick: action
        },
        controlIcon(icon)
      )
    }

    return () => {
      const status = state.value?.status ?? 'idle'
      const text = triggerText(status, props.label ?? props.generateId)
      const filterId = `gentorial-mini-liquid-${props.generateId.replace(/[^a-z0-9_-]/giu, '-')}`
      return h('span', { class: 'gentorial-generation-controls ignore-header' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'gentorial-generate-trigger',
            'data-status': status,
            'aria-controls': `gentorial-generated-${props.generateId}`,
            'aria-label': text,
            'aria-expanded': state.value?.expanded ?? false,
            'aria-busy': status === 'loading' ? 'true' : undefined,
            'aria-disabled': status === 'loading' || status === 'success' ? 'true' : undefined,
            title: text,
            disabled: !runtime,
            onClick: activate
          },
          h('span', { class: 'gentorial-mini-orb', 'aria-hidden': 'true' }, [
            h('span', { class: 'gentorial-mini-orb__base' }),
            h('span', {
              class: 'gentorial-mini-orb__liquid-primary',
              style: {
                rotate: `${primaryRotation.value}deg`,
                filter: `url(#${filterId}) blur(0.25px)`
              }
            }),
            h('span', {
              class: 'gentorial-mini-orb__liquid-secondary',
              style: { rotate: `${secondaryRotation.value}deg` }
            }),
            h('span', { class: 'gentorial-mini-orb__sheen' })
          ])
        ),
        ...(status === 'success'
          ? [
              h('span', { class: 'gentorial-generation-toolbar' }, [
                control('重新生成', 'regenerate', () => {
                  feedback.value = undefined
                  copied.value = undefined
                  void runtime?.run(props.generateId)
                }),
                control(copied.value === 'text' ? '已复制文字' : '复制文字', 'copy', () => {
                  void copy('text')
                }),
                control(
                  copied.value === 'markdown' ? '已复制 Markdown' : '复制 Markdown',
                  'markdown',
                  () => {
                    void copy('markdown')
                  }
                ),
                control(
                  '赞同',
                  'up',
                  () => {
                    feedback.value = feedback.value === 'up' ? undefined : 'up'
                  },
                  feedback.value === 'up'
                ),
                control(
                  '反对',
                  'down',
                  () => {
                    feedback.value = feedback.value === 'down' ? undefined : 'down'
                  },
                  feedback.value === 'down'
                ),
                control(
                  state.value?.expanded ? '收起讲解' : '展开讲解',
                  state.value?.expanded ? 'collapse' : 'expand',
                  () => runtime?.setExpanded(props.generateId, !state.value?.expanded)
                )
              ])
            ]
          : []),
        h(
          'svg',
          {
            class: 'gentorial-mini-orb__filter',
            width: '0',
            height: '0',
            'aria-hidden': 'true'
          },
          [
            h('defs', [
              h(
                'filter',
                {
                  id: filterId,
                  x: '-35%',
                  y: '-35%',
                  width: '170%',
                  height: '170%',
                  colorInterpolationFilters: 'sRGB'
                },
                [
                  h('feTurbulence', {
                    type: 'fractalNoise',
                    baseFrequency: '0.075 0.11',
                    numOctaves: '2',
                    seed: '19',
                    result: 'noise'
                  }),
                  h('feDisplacementMap', {
                    in: 'SourceGraphic',
                    in2: 'noise',
                    scale: '7',
                    xChannelSelector: 'R',
                    yChannelSelector: 'B'
                  })
                ]
              )
            ])
          ]
        )
      ])
    }
  }
})

export const GentorialGeneratedRegion = defineComponent({
  name: 'GentorialGeneratedRegion',
  props: {
    spec: {
      type: Object as PropType<GenerateSpec>,
      required: true
    },
    concepts: {
      type: Array as PropType<ConceptSpec[]>,
      required: true
    },
    learner: {
      type: Object as PropType<LearnerProfile>,
      required: false
    },
    fallback: {
      type: Array as PropType<LessonBlock[]>,
      default: () => []
    }
  },
  setup(props) {
    const runtime = inject(gentorialRuntimeKey, undefined)
    const state = computed(() => runtime?.getState(props.spec.id))
    const question = ref('')
    const pathExpanded = ref(false)
    let unregister: (() => void) | undefined

    if (runtime) {
      watch(
        () => [props.spec, props.concepts, props.learner, props.fallback] as const,
        () => {
          unregister?.()
          unregister = runtime.register({
            generate: props.spec,
            concepts: props.concepts,
            ...(props.learner ? { learner: props.learner } : {}),
            fallback: props.fallback
          })
        },
        { deep: true, immediate: true }
      )

      watch(
        () => state.value?.status,
        (status) => {
          if (status !== 'loading') return
          question.value = ''
        },
        { flush: 'sync' }
      )
    }

    onBeforeUnmount(() => unregister?.())

    function clearQuestion(cancel: boolean): void {
      if (cancel) runtime?.cancelFollowUp(props.spec.id)
      question.value = ''
    }

    function submitQuestion(): void {
      const content = question.value.trim()
      if (!runtime || content.length === 0 || state.value?.followUpStatus === 'loading') return

      clearQuestion(false)
      void runtime.ask(props.spec.id, content)
    }

    function handleInputKeydown(event: KeyboardEvent): void {
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        submitQuestion()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        clearQuestion(true)
      }
    }

    function renderConversationNode(
      node: GentorialConversationNode,
      childrenByParent: ReadonlyMap<string, readonly GentorialConversationNode[]>,
      activePath: ReadonlySet<string>,
      nodeIndexes: ReadonlyMap<string, number>
    ): VNode {
      const children = childrenByParent.get(node.id) ?? []
      const active = state.value?.activeConversationNodeId === node.id
      const label = node.question ?? '初始内容'
      const tooltipId = `gentorial-path-${props.spec.id}-${nodeIndexes.get(node.id) ?? 0}`

      return h(
        'li',
        {
          key: node.id,
          class: 'gentorial-conversation-path__node',
          'data-on-active-path': activePath.has(node.id) ? 'true' : 'false'
        },
        [
          h('div', { class: 'gentorial-conversation-path__point-wrap' }, [
            h(
              'button',
              {
                type: 'button',
                class: 'gentorial-conversation-path__point',
                'aria-label': label,
                'aria-describedby': tooltipId,
                'aria-current': active ? 'step' : undefined,
                onClick: () => runtime?.selectConversationNode(props.spec.id, node.id)
              },
              h('span', { 'aria-hidden': 'true' })
            ),
            h(
              'span',
              {
                id: tooltipId,
                class: 'gentorial-conversation-path__tooltip',
                role: 'tooltip'
              },
              label
            )
          ]),
          ...(children.length > 0
            ? [
                h(
                  'ul',
                  { class: 'gentorial-conversation-path__children' },
                  children.map((child) =>
                    renderConversationNode(child, childrenByParent, activePath, nodeIndexes)
                  )
                )
              ]
            : [])
        ]
      )
    }

    return () => {
      const current = state.value
      const regionId = `gentorial-generated-${props.spec.id}`

      if (!runtime || !current) return null

      const hasLesson = current.blocks.length > 0
      const showMainError = current.status === 'error' && Boolean(current.error)
      const showFollowUpError =
        current.followUpStatus === 'error' && Boolean(current.followUpError)
      const showError = showMainError || showFollowUpError
      if (!hasLesson && !showError) return null

      const inputId = `gentorial-follow-up-${props.spec.id}`
      const statusId = `${inputId}-status`
      const pathId = `gentorial-conversation-path-${props.spec.id}`
      const assistantLessons = current.conversation.flatMap((turn, index) =>
        turn.role === 'assistant'
          ? [
              h(LessonBlockRenderer, {
                key: `assistant-${index}`,
                blocks: turn.lesson.blocks,
                ...(turn.lesson.markdown ? { markdown: turn.lesson.markdown } : {})
              })
            ]
          : []
      )
      const streamingFollowUp =
        current.streamingFollowUpBlocks.length > 0
          ? [
              h(LessonBlockRenderer, {
                key: 'assistant-stream',
                blocks: current.streamingFollowUpBlocks,
                ...(current.streamingFollowUpMarkdown
                  ? { markdown: current.streamingFollowUpMarkdown }
                  : {})
              })
            ]
          : []
      const hiddenStyle = {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0'
      } as const
      const childrenByParent = new Map<string, GentorialConversationNode[]>()
      const nodesById = new Map(current.conversationNodes.map((node) => [node.id, node]))
      const nodeIndexes = new Map(current.conversationNodes.map((node, index) => [node.id, index]))
      for (const node of current.conversationNodes) {
        if (!node.parentId) continue
        const siblings = childrenByParent.get(node.parentId) ?? []
        siblings.push(node)
        childrenByParent.set(node.parentId, siblings)
      }
      const activePath = new Set<string>()
      let pathNode = current.activeConversationNodeId
        ? nodesById.get(current.activeConversationNodeId)
        : undefined
      while (pathNode && !activePath.has(pathNode.id)) {
        activePath.add(pathNode.id)
        pathNode = pathNode.parentId ? nodesById.get(pathNode.parentId) : undefined
      }
      const rootNode = current.rootConversationNodeId
        ? nodesById.get(current.rootConversationNodeId)
        : undefined

      return h(
        'section',
        {
          id: regionId,
          class: [
            'gentorial-generated-region',
            showError
              ? 'gentorial-generated-region--error'
              : 'gentorial-generated-region--success'
          ],
          'data-expanded': showError || current.expanded ? 'true' : 'false',
          'data-status': current.status,
          'aria-hidden': showError || current.expanded ? undefined : 'true',
          inert: showError || current.expanded ? undefined : '',
          'data-generate-id': props.spec.id,
          'aria-label': showError ? 'AI 生成失败' : '继续提问',
          'aria-busy':
            current.status === 'loading' || current.followUpStatus === 'loading'
              ? 'true'
              : undefined
        },
        [
          ...(showMainError
            ? [
                h(
                  'p',
                  {
                    class: 'gentorial-generated-region__error',
                    role: 'alert',
                    'aria-live': 'assertive'
                  },
                  current.error
                )
              ]
            : []),
          ...(hasLesson
            ? [
                h(LessonBlockRenderer, {
                  key: 'base',
                  blocks: current.blocks,
                  ...(current.markdown ? { markdown: current.markdown } : {})
                }),
                ...assistantLessons,
                ...streamingFollowUp,
                ...(showFollowUpError
                  ? [
                      h(
                        'p',
                        {
                          id: statusId,
                          class: [
                            'gentorial-generated-region__error',
                            'gentorial-generated-region__follow-up-error'
                          ],
                          role: 'alert',
                          'aria-live': 'assertive'
                        },
                        current.followUpError
                      )
                    ]
                  : []),
                h('div', { class: 'gentorial-conversation-path__controls' }, [
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'gentorial-conversation-path__toggle',
                      'aria-expanded': pathExpanded.value ? 'true' : 'false',
                      'aria-controls': pathId,
                      onClick: () => {
                        pathExpanded.value = !pathExpanded.value
                      }
                    },
                    [h(ListTree, { 'aria-hidden': 'true' }), h('span', '学习路径')]
                  )
                ]),
                ...(pathExpanded.value && rootNode
                  ? [
                      h(
                        'nav',
                        {
                          id: pathId,
                          class: 'gentorial-conversation-path',
                          'aria-label': '学习路径'
                        },
                        [
                          h(
                            'ul',
                            { class: 'gentorial-conversation-path__tree' },
                            [renderConversationNode(rootNode, childrenByParent, activePath, nodeIndexes)]
                          )
                        ]
                      )
                    ]
                  : []),
                h(
                  'div',
                  {
                    class: 'gentorial-generated-region__follow-up-composer'
                  },
                  [
                    h('label', { for: inputId, style: hiddenStyle }, '继续提问'),
                    h('input', {
                      id: inputId,
                      class: 'gentorial-generated-region__follow-up-input',
                      type: 'text',
                      value: question.value,
                      placeholder: '继续追问…',
                      'aria-describedby': current.followUpError ? statusId : undefined,
                      'aria-invalid': current.followUpStatus === 'error' ? 'true' : undefined,
                      onInput: (event: Event) => {
                        question.value = (event.currentTarget as HTMLInputElement).value
                      },
                      onKeydown: handleInputKeydown
                    }),
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'gentorial-generated-region__follow-up-submit',
                        disabled:
                          question.value.trim().length === 0 ||
                          current.followUpStatus === 'loading',
                        onClick: submitQuestion
                      },
                      '发送'
                    )
                  ]
                )
              ]
            : [])
        ]
      )
    }
  }
})

type SelectOption<T extends string> = {
  value: T
  label: string
}

const detailOptions: SelectOption<NonNullable<LearnerProfile['detail']>>[] = [
  { value: 'concise', label: '简洁' },
  { value: 'balanced', label: '均衡' },
  { value: 'deep', label: '深入' }
]

const toneOptions: SelectOption<NonNullable<LearnerProfile['tone']>>[] = [
  { value: 'neutral', label: '中性' },
  { value: 'conversational', label: '对话' },
  { value: 'formal', label: '正式' }
]

const narrativeOptions: SelectOption<NonNullable<LearnerProfile['narrative']>>[] = [
  { value: 'direct', label: '直接' },
  { value: 'story', label: '故事' },
  { value: 'timeline', label: '时间线' }
]

export const GentorialPreferences = defineComponent({
  name: 'GentorialPreferences',
  props: {
    presentation: {
      type: String as PropType<'inline' | 'nav'>,
      default: 'inline'
    }
  },
  setup(props) {
    const runtime = inject(gentorialRuntimeKey, undefined)
    const savedByok = runtime?.byokSession.value
    const step = ref<'preferences' | 'byok'>('preferences')
    const completed = ref(false)
    const open = ref(props.presentation === 'inline')
    const provider = ref(savedByok?.provider ?? 'openai')
    const apiKey = ref(savedByok?.apiKey ?? '')
    const model = ref(savedByok?.model ?? 'gpt-5.6-terra')
    const baseUrl = ref(savedByok?.baseUrl ?? savedByok?.endpoint ?? 'https://api.openai.com/v1')
    let dialogElement: HTMLElement | undefined
    let triggerElement: HTMLButtonElement | undefined

    const providerDefaults: Record<string, { model: string; baseUrl: string }> = {
      openai: {
        model: 'gpt-5.6-terra',
        baseUrl: 'https://api.openai.com/v1'
      },
      anthropic: {
        model: 'claude-sonnet-5',
        baseUrl: 'https://api.anthropic.com/v1'
      },
      google: {
        model: 'gemini-3.5-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
      },
      custom: { model: '', baseUrl: '' }
    }

    function handleDialogKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && open.value && props.presentation === 'nav') {
        open.value = false
        return
      }
      if (event.key !== 'Tab' || !open.value || !dialogElement) return
      const focusable = [
        ...dialogElement.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ]
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    watch(open, (visible) => {
      if (typeof document === 'undefined' || props.presentation !== 'nav') return
      document.documentElement.classList.toggle('gentorial-preferences-open', visible)
      if (visible) {
        void nextTick(() => dialogElement?.focus())
      } else {
        triggerElement?.focus()
      }
    })
    onMounted(() => window.addEventListener('keydown', handleDialogKeydown))
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleDialogKeydown)
      document.documentElement.classList.remove('gentorial-preferences-open')
    })

    function update<K extends 'detail' | 'tone' | 'narrative'>(
      key: K,
      value: NonNullable<LearnerProfile[K]>
    ): void {
      if (!runtime) return
      runtime.setLearnerProfile({
        ...runtime.learnerProfile.value,
        [key]: value
      })
    }

    function preferenceGroup<K extends 'detail' | 'tone' | 'narrative'>(
      key: K,
      label: string,
      options: SelectOption<NonNullable<LearnerProfile[K]>>[]
    ): VNodeChild {
      const fallback = options[0]?.value ?? ''
      const value = runtime?.learnerProfile.value[key] ?? fallback
      return h('fieldset', { class: 'gentorial-preferences__group' }, [
        h('legend', { class: 'gentorial-preferences__legend' }, label),
        h(
          'div',
          { class: 'gentorial-preferences__options' },
          options.map((option) => {
            const selected = option.value === value
            return h(
              'button',
              {
                key: option.value,
                class: [
                  'gentorial-preferences__option',
                  selected && 'gentorial-preferences__option--selected'
                ],
                type: 'button',
                disabled: !runtime,
                'aria-pressed': selected,
                'data-preference-key': key,
                'data-preference-value': option.value,
                onClick: () => update(key, option.value)
              },
              [h('span', option.label), controlIcon('check')]
            )
          })
        )
      ])
    }

    function finish(skip: boolean): void {
      runtime?.setByokSession(
        skip || !apiKey.value.trim()
          ? undefined
          : {
              provider: provider.value,
              apiKey: apiKey.value.trim(),
              ...(model.value.trim() ? { model: model.value.trim() } : {}),
              ...(baseUrl.value.trim() ? { baseUrl: baseUrl.value.trim() } : {})
            }
      )
      completed.value = true
      open.value = false
    }

    function renderCard(): VNode {
      const canGoBack = step.value === 'byok' || props.presentation === 'nav'
      const header = h('div', { class: 'gentorial-preferences__header' }, [
        canGoBack
          ? h(
              'button',
              {
                class: 'gentorial-preferences__back',
                type: 'button',
                onClick: () => {
                  if (step.value === 'byok') step.value = 'preferences'
                  else open.value = false
                }
              },
              [controlIcon('arrow-left'), h('span', '返回')]
            )
          : h('span'),
        h(
          'span',
          { class: 'gentorial-preferences__step' },
          step.value === 'preferences' ? '1 / 2 · Preferences' : '2 / 2 · BYOK'
        )
      ])

      if (step.value === 'preferences') {
        return h(
          'section',
          {
            class: 'gentorial-preferences',
            tabindex: props.presentation === 'nav' ? -1 : undefined,
            ref: (element) => {
              dialogElement = element as HTMLElement
            }
          },
          [
            header,
            h('div', { class: 'gentorial-preferences__fields' }, [
              preferenceGroup('detail', '内容深度', detailOptions),
              preferenceGroup('tone', '表达语气', toneOptions),
              preferenceGroup('narrative', '叙事方式', narrativeOptions)
            ]),
            h('div', { class: 'gentorial-preferences__actions' }, [
              h(
                'button',
                {
                  class: 'gentorial-preferences__primary',
                  type: 'button',
                  onClick: () => {
                    step.value = 'byok'
                  }
                },
                [h('span', '继续'), controlIcon('arrow-right')]
              )
            ])
          ]
        )
      }

      return h(
        'section',
        {
          class: 'gentorial-preferences',
          tabindex: props.presentation === 'nav' ? -1 : undefined,
          ref: (element) => {
            dialogElement = element as HTMLElement
          }
        },
        [
          header,
          h('div', { class: 'gentorial-preferences__byok' }, [
            h('label', { class: 'gentorial-preferences__field' }, [
              h('span', '提供方'),
              h(
                'select',
                {
                  value: provider.value,
                  onChange: (event: Event) => {
                    provider.value = (event.currentTarget as HTMLSelectElement).value
                    const defaults = providerDefaults[provider.value] ?? providerDefaults.custom!
                    model.value = defaults.model
                    baseUrl.value = defaults.baseUrl
                  }
                },
                [
                  ['openai', 'OpenAI'],
                  ['anthropic', 'Anthropic'],
                  ['google', 'Google'],
                  ['custom', 'OpenAI-compatible']
                ].map(([value, label]) => h('option', { value }, label))
              )
            ]),
            h('label', { class: 'gentorial-preferences__field' }, [
              h('span', '模型'),
              h('input', {
                type: 'text',
                value: model.value,
                spellcheck: false,
                placeholder:
                  provider.value === 'custom'
                    ? '必填，例如 llama3.2'
                    : providerDefaults[provider.value]?.model,
                onInput: (event: Event) => {
                  model.value = (event.currentTarget as HTMLInputElement).value
                }
              })
            ]),
            h('label', { class: 'gentorial-preferences__field' }, [
              h('span', 'API key'),
              h('input', {
                type: 'password',
                value: apiKey.value,
                autocomplete: 'off',
                spellcheck: false,
                placeholder: runtime?.persistence.persistApiKey
                  ? '保存在当前站点的浏览器存储中'
                  : '仅保存在当前页面会话内存中',
                onInput: (event: Event) => {
                  apiKey.value = (event.currentTarget as HTMLInputElement).value
                }
              })
            ]),
            h(
              'label',
              {
                class: 'gentorial-preferences__field gentorial-preferences__field--wide'
              },
              [
                h('span', 'Base URL'),
                h('input', {
                  type: 'url',
                  value: baseUrl.value,
                  spellcheck: false,
                  placeholder:
                    providerDefaults[provider.value]?.baseUrl || 'https://example.com/v1',
                  onInput: (event: Event) => {
                    baseUrl.value = (event.currentTarget as HTMLInputElement).value
                  }
                })
              ]
            )
          ]),
          h(
            'p',
            { class: 'gentorial-preferences__notice' },
            runtime?.persistence.persistApiKey
              ? '密钥仅保存在当前站点的浏览器存储中，不会写入静态产物或日志。公共设备使用后请点击“跳过”清除密钥。'
              : '可跳过。浏览器直连密钥不会写入静态产物、localStorage 或日志。'
          ),
          h('div', { class: 'gentorial-preferences__actions' }, [
            h(
              'button',
              {
                class: 'gentorial-preferences__secondary',
                type: 'button',
                onClick: () => finish(true)
              },
              '跳过'
            ),
            h(
              'button',
              {
                class: 'gentorial-preferences__primary',
                type: 'button',
                disabled:
                  !apiKey.value.trim() ||
                  (provider.value === 'custom' && (!model.value.trim() || !baseUrl.value.trim())),
                onClick: () => finish(false)
              },
              [h('span', '保存并继续'), controlIcon('arrow-right')]
            )
          ])
        ]
      )
    }

    function openPreferences(): void {
      step.value = 'preferences'
      completed.value = false
      open.value = true
    }

    return () => {
      if (props.presentation === 'nav') {
        const trigger = h(
          'button',
          {
            class: 'gentorial-preferences__nav-trigger',
            type: 'button',
            title: '个性化设置',
            'aria-label': '个性化设置',
            'aria-haspopup': 'dialog',
            'aria-expanded': open.value,
            ref: (element) => {
              triggerElement = element as HTMLButtonElement
            },
            onClick: openPreferences
          },
          controlIcon('preferences')
        )

        return h('span', { class: 'gentorial-preferences__nav-host' }, [
          trigger,
          ...(open.value
            ? [
                h(
                  Teleport,
                  { to: 'body' },
                  h(
                    'div',
                    {
                      class: 'gentorial-preferences__overlay',
                      role: 'dialog',
                      'aria-modal': 'true',
                      'aria-label': '个性化设置',
                      onClick: (event: MouseEvent) => {
                        if (event.target === event.currentTarget) open.value = false
                      }
                    },
                    [renderCard()]
                  )
                )
              ]
            : [])
        ])
      }

      if (completed.value) {
        return h(
          'button',
          {
            class: 'gentorial-preferences__trigger',
            type: 'button',
            onClick: openPreferences
          },
          '个性化设置'
        )
      }
      return renderCard()
    }
  }
})

/**
 * Compatibility wrapper for existing engines. New integrations should place
 * GentorialGenerateTrigger in the heading and GentorialGeneratedRegion after
 * the author-owned source text.
 */
export const GentorialGenerate = defineComponent({
  name: 'GentorialGenerate',
  props: {
    spec: {
      type: Object as PropType<GenerateSpec>,
      required: true
    },
    concepts: {
      type: Array as PropType<ConceptSpec[]>,
      required: true
    },
    learner: {
      type: Object as PropType<LearnerProfile>,
      required: false
    },
    fallback: {
      type: Array as PropType<LessonBlock[]>,
      default: () => []
    }
  },
  setup(props) {
    return () =>
      h(
        'section',
        {
          class: ['gentorial-generate', 'gentorial-generate--compat'],
          'data-generate-id': props.spec.id
        },
        [
          h(GentorialGenerateTrigger, { generateId: props.spec.id }),
          h(GentorialGeneratedRegion, {
            spec: props.spec,
            concepts: props.concepts,
            fallback: props.fallback,
            ...(props.learner ? { learner: props.learner } : {})
          })
        ]
      )
  }
})
