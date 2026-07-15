import type {
  ConceptSpec,
  GenerateSpec,
  LearnerProfile,
  LessonBlock
} from '@gentorial/core'
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
  type PropType,
  type VNode,
  type VNodeChild
} from 'vue'
import {
  gentorialRuntimeKey,
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
    return () => h(
      'div',
      { class: 'gentorial-markdown' },
      renderGentorialMarkdown(props.source)
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
          h('code', { class: block.language ? `language-${block.language}` : undefined }, block.code)
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
          h('ul', block.left.items.map((item, index) => h('li', { key: index }, item)))
        ]),
        h('section', [
          h('h4', block.right.title),
          h('ul', block.right.items.map((item, index) => h('li', { key: index }, item)))
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
    return () => props.markdown
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
  return blocks.map((block) => {
    switch (block.type) {
      case 'paragraph':
        return block.text
      case 'heading':
        return markdown ? `${'#'.repeat(block.level)} ${block.text}` : block.text
      case 'list':
        return block.items.map((item, index) =>
          markdown ? `${block.ordered ? `${index + 1}.` : '-'} ${item}` : item
        ).join('\n')
      case 'code':
        return markdown
          ? `${block.caption ? `${block.caption}\n\n` : ''}\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``
          : `${block.caption ? `${block.caption}\n` : ''}${block.code}`
      case 'callout':
        return [block.title, block.text].filter(Boolean).join('\n')
      case 'comparison':
        return [block.left, block.right].map((side) =>
          `${side.title}\n${side.items.map((item) => markdown ? `- ${item}` : item).join('\n')}`
        ).join('\n\n')
    }
  }).join('\n\n')
}

type ControlIcon = 'regenerate' | 'copy' | 'markdown' | 'up' | 'down' | 'expand' | 'collapse' | 'preferences'

function controlIcon(icon: ControlIcon): VNode {
  const paths: Record<ControlIcon, VNodeChild[]> = {
    regenerate: [h('path', { d: 'M20 11a8.1 8.1 0 1 0 2.2 5.5' }), h('path', { d: 'M20 4v7h-7' })],
    copy: [h('rect', { x: '9', y: '9', width: '11', height: '11', rx: '2' }), h('path', { d: 'M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3' })],
    markdown: [h('path', { d: 'M4 5h16v14H4z' }), h('path', { d: 'M7 15V9l2.5 3L12 9v6M15 12l2 2 2-2M17 9v5' })],
    up: [h('path', { d: 'M7 10v12H3V10h4Zm0 10h10.3a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 18.7 9H14l.7-3.5A3 3 0 0 0 12 2l-5 8' })],
    down: [h('path', { d: 'M7 14V2H3v12h4Zm0-10h10.3a2 2 0 0 1 2 1.6l1.4 7a2 2 0 0 1-2 2.4H14l.7 3.5A3 3 0 0 1 12 22l-5-8' })],
    expand: [h('path', { d: 'M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5' })],
    collapse: [h('path', { d: 'M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5' })],
    preferences: [h('path', { d: 'M4 7h10M18 7h2M4 17h2M10 17h10' }), h('circle', { cx: '16', cy: '7', r: '2' }), h('circle', { cx: '8', cy: '17', r: '2' })]
  }
  return h('svg', {
    viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
  }, paths[icon])
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

    watch(() => state.value?.status, (status) => {
      transitionStarted = typeof performance === 'undefined' ? 0 : performance.now()
      primaryStart = primarySpeed
      secondaryStart = secondarySpeed
      primaryTarget = status === 'loading' ? 620 : 62
      secondaryTarget = status === 'loading' ? -430 : -43
    })

    onMounted(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const tick = (time: number) => {
        const delta = lastFrame ? Math.min(time - lastFrame, 64) : 0
        lastFrame = time
        const progress = Math.min(Math.max((time - transitionStarted) / 1000, 0), 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        primarySpeed = primaryStart + (primaryTarget - primaryStart) * eased
        secondarySpeed = secondaryStart + (secondaryTarget - secondaryStart) * eased
        primaryRotation.value = (primaryRotation.value + primarySpeed * delta / 1000) % 360
        secondaryRotation.value = (secondaryRotation.value + secondarySpeed * delta / 1000) % 360
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
        ...state.value.conversation.flatMap((turn) => turn.role === 'assistant'
          ? [turn.lesson.markdown ?? blocksAsText(turn.lesson.blocks, true)]
          : [])
      ]
      const markdown = sources.filter(Boolean).join('\n\n')
      await navigator.clipboard.writeText(format === 'markdown'
        ? markdown
        : gentorialMarkdownAsText(markdown))
      copied.value = format
      window.setTimeout(() => { copied.value = undefined }, 1200)
    }

    function control(label: string, icon: ControlIcon, action: () => void, active = false): VNode {
      return h('button', {
        type: 'button', class: 'gentorial-generation-toolbar__button', title: label,
        'aria-label': label, 'aria-pressed': active || undefined, onClick: action
      }, controlIcon(icon))
    }

    return () => {
      const status = state.value?.status ?? 'idle'
      const text = triggerText(status, props.label ?? props.generateId)
      const filterId = `gentorial-mini-liquid-${props.generateId.replace(/[^a-z0-9_-]/giu, '-')}`
      return h('span', { class: 'gentorial-generation-controls ignore-header' }, [
        h('button', {
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
        }, h('span', { class: 'gentorial-mini-orb', 'aria-hidden': 'true' }, [
          h('span', { class: 'gentorial-mini-orb__base' }),
          h('span', { class: 'gentorial-mini-orb__liquid-primary', style: { rotate: `${primaryRotation.value}deg`, filter: `url(#${filterId}) blur(0.25px)` } }),
          h('span', { class: 'gentorial-mini-orb__liquid-secondary', style: { rotate: `${secondaryRotation.value}deg` } }),
          h('span', { class: 'gentorial-mini-orb__sheen' })
        ])),
        ...(status === 'success' ? [h('span', { class: 'gentorial-generation-toolbar' }, [
          control('重新生成', 'regenerate', () => { feedback.value = undefined; copied.value = undefined; void runtime?.run(props.generateId) }),
          control(copied.value === 'text' ? '已复制文字' : '复制文字', 'copy', () => { void copy('text') }),
          control(copied.value === 'markdown' ? '已复制 Markdown' : '复制 Markdown', 'markdown', () => { void copy('markdown') }),
          control('赞同', 'up', () => { feedback.value = feedback.value === 'up' ? undefined : 'up' }, feedback.value === 'up'),
          control('反对', 'down', () => { feedback.value = feedback.value === 'down' ? undefined : 'down' }, feedback.value === 'down'),
          control(state.value?.expanded ? '收起讲解' : '展开讲解', state.value?.expanded ? 'collapse' : 'expand', () => runtime?.setExpanded(props.generateId, !state.value?.expanded))
        ])] : []),
        h('svg', { class: 'gentorial-mini-orb__filter', width: '0', height: '0', 'aria-hidden': 'true' }, [
          h('defs', [h('filter', { id: filterId, x: '-35%', y: '-35%', width: '170%', height: '170%', colorInterpolationFilters: 'sRGB' }, [
            h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.075 0.11', numOctaves: '2', seed: '19', result: 'noise' }),
            h('feDisplacementMap', { in: 'SourceGraphic', in2: 'noise', scale: '7', xChannelSelector: 'R', yChannelSelector: 'B' })
          ])])
        ])
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
      if (
        !runtime ||
        content.length === 0 ||
        state.value?.followUpStatus === 'loading'
      ) return

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

    return () => {
      const current = state.value
      const regionId = `gentorial-generated-${props.spec.id}`

      if (!runtime || !current || current.blocks.length === 0) return null

      const inputId = `gentorial-follow-up-${props.spec.id}`
      const statusId = `${inputId}-status`
      const assistantLessons = current.conversation.flatMap((turn, index) =>
        turn.role === 'assistant'
          ? [h(LessonBlockRenderer, {
              key: `assistant-${index}`,
              blocks: turn.lesson.blocks,
              ...(turn.lesson.markdown ? { markdown: turn.lesson.markdown } : {})
            })]
          : []
      )
      const streamingFollowUp = current.streamingFollowUpBlocks.length > 0
        ? [h(LessonBlockRenderer, {
            key: 'assistant-stream',
            blocks: current.streamingFollowUpBlocks,
            ...(current.streamingFollowUpMarkdown
              ? { markdown: current.streamingFollowUpMarkdown }
              : {})
          })]
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

      return h(
        'section',
        {
          id: regionId,
          class: ['gentorial-generated-region', 'gentorial-generated-region--success'],
          'data-expanded': current.expanded ? 'true' : 'false',
          'aria-hidden': current.expanded ? undefined : 'true',
          inert: current.expanded ? undefined : '',
          'data-generate-id': props.spec.id,
          'aria-label': '继续提问',
          'aria-busy': current.status === 'loading' || current.followUpStatus === 'loading'
            ? 'true'
            : undefined
        },
        [
          h(LessonBlockRenderer, {
            key: 'base',
            blocks: current.blocks,
            ...(current.markdown ? { markdown: current.markdown } : {})
          }),
          ...assistantLessons,
          ...streamingFollowUp,
          ...(current.followUpError
            ? [
                h(
                  'span',
                  {
                    id: statusId,
                    class: 'gentorial-generated-region__follow-up-semantic-status',
                    style: hiddenStyle,
                    'aria-live': 'assertive'
                  },
                  current.followUpError
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
              h(
                'input',
                {
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
                }
              ),
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
  { value: 'timeline', label: '时间线' },
  { value: 'comparison', label: '对比' }
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
    const step = ref<'preferences' | 'byok'>('preferences')
    const completed = ref(false)
    const open = ref(props.presentation === 'inline')
    const provider = ref('openai')
    const apiKey = ref('')
    const model = ref('gpt-5.6-terra')
    const baseUrl = ref('https://api.openai.com/v1')
    let dialogElement: HTMLElement | undefined
    let triggerElement: HTMLButtonElement | undefined

    const providerDefaults: Record<string, { model: string; baseUrl: string }> = {
      openai: { model: 'gpt-5.6-terra', baseUrl: 'https://api.openai.com/v1' },
      anthropic: { model: 'claude-sonnet-5', baseUrl: 'https://api.anthropic.com/v1' },
      google: { model: 'gemini-3.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
      custom: { model: '', baseUrl: '' }
    }

    function handleDialogKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && open.value && props.presentation === 'nav') {
        open.value = false
        return
      }
      if (event.key !== 'Tab' || !open.value || !dialogElement) return
      const focusable = [...dialogElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )]
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

    function select<K extends 'detail' | 'tone' | 'narrative'>(
      key: K,
      label: string,
      options: SelectOption<NonNullable<LearnerProfile[K]>>[]
    ): VNodeChild {
      const fallback = options[0]?.value ?? ''
      const value = runtime?.learnerProfile.value[key] ?? fallback
      return h('label', { class: 'gentorial-preferences__field' }, [
        h('span', label),
        h(
          'select',
          {
            value,
            disabled: !runtime,
            onChange: (event: Event) => {
              update(key, (event.currentTarget as HTMLSelectElement).value as NonNullable<LearnerProfile[K]>)
            }
          },
          options.map((option) =>
            h(
              'option',
              {
                key: option.value,
                value: option.value,
                selected: option.value === value
              },
              option.label
            )
          )
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
      const header = h('div', { class: 'gentorial-preferences__header' }, [
        step.value === 'byok'
          ? h(
              'button',
              {
                class: 'gentorial-preferences__back',
                type: 'button',
                onClick: () => { step.value = 'preferences' }
              },
              '← 返回'
            )
          : h('span'),
        h(
          'span',
          { class: 'gentorial-preferences__step' },
          step.value === 'preferences' ? '1 / 2 · Preferences' : '2 / 2 · BYOK'
        )
      ])

      if (step.value === 'preferences') {
        return h('section', { class: 'gentorial-preferences', role: props.presentation === 'nav' ? 'dialog' : undefined, 'aria-modal': props.presentation === 'nav' ? 'true' : undefined, 'aria-label': '个性化设置', tabindex: props.presentation === 'nav' ? -1 : undefined, ref: (element) => { dialogElement = element as HTMLElement } }, [
          header,
          h('div', { class: 'gentorial-preferences__fields' }, [
            select('detail', '内容深度', detailOptions),
            select('tone', '表达语气', toneOptions),
            select('narrative', '叙事方式', narrativeOptions)
          ]),
          h('div', { class: 'gentorial-preferences__actions' }, [
            h(
              'button',
              {
                class: 'gentorial-preferences__primary',
                type: 'button',
                onClick: () => { step.value = 'byok' }
              },
              '继续 →'
            )
          ])
        ])
      }

      return h('section', { class: 'gentorial-preferences', role: props.presentation === 'nav' ? 'dialog' : undefined, 'aria-modal': props.presentation === 'nav' ? 'true' : undefined, 'aria-label': '个性化设置', tabindex: props.presentation === 'nav' ? -1 : undefined, ref: (element) => { dialogElement = element as HTMLElement } }, [
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
            h('span', 'API key'),
            h('input', {
              type: 'password',
              value: apiKey.value,
              autocomplete: 'off',
              spellcheck: false,
              placeholder: '仅保存在当前页面会话内存中',
              onInput: (event: Event) => {
                apiKey.value = (event.currentTarget as HTMLInputElement).value
              }
            })
          ]),
          h('label', { class: 'gentorial-preferences__field' }, [
            h('span', '模型'),
            h('input', {
              type: 'text',
              value: model.value,
              spellcheck: false,
              placeholder: provider.value === 'custom'
                ? '必填，例如 llama3.2'
                : providerDefaults[provider.value]?.model,
              onInput: (event: Event) => {
                model.value = (event.currentTarget as HTMLInputElement).value
              }
            })
          ]),
          h('label', { class: 'gentorial-preferences__field gentorial-preferences__field--wide' }, [
            h('span', 'Base URL'),
            h('input', {
              type: 'url',
              value: baseUrl.value,
              spellcheck: false,
              placeholder: providerDefaults[provider.value]?.baseUrl || 'https://example.com/v1',
              onInput: (event: Event) => {
                baseUrl.value = (event.currentTarget as HTMLInputElement).value
              }
            })
          ])
        ]),
        h(
          'p',
          { class: 'gentorial-preferences__notice' },
          '可跳过。浏览器直连密钥不会写入静态产物、localStorage 或日志。'
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
              disabled: !apiKey.value.trim() || (provider.value === 'custom' && (!model.value.trim() || !baseUrl.value.trim())),
              onClick: () => finish(false)
            },
            '保存并继续'
          )
        ])
      ])
    }

    function openPreferences(): void {
      step.value = 'preferences'
      completed.value = false
      open.value = true
    }

    return () => {
      if (props.presentation === 'nav') {
        const trigger = h('button', {
          class: 'gentorial-preferences__nav-trigger',
          type: 'button',
          title: '个性化设置',
          'aria-label': '个性化设置',
          'aria-haspopup': 'dialog',
          'aria-expanded': open.value,
          ref: (element) => { triggerElement = element as HTMLButtonElement },
          onClick: openPreferences
        }, controlIcon('preferences'))

        return h('span', { class: 'gentorial-preferences__nav-host' }, [
          trigger,
          ...(open.value
            ? [h(Teleport, { to: 'body' }, h('div', {
                class: 'gentorial-preferences__overlay',
                onClick: (event: MouseEvent) => {
                  if (event.target === event.currentTarget) open.value = false
                }
              }, [
                renderCard(),
                h('button', {
                  class: 'gentorial-preferences__close',
                  type: 'button',
                  'aria-label': '关闭个性化设置',
                  onClick: () => { open.value = false }
                }, '×')
              ]))]
            : [])
        ])
      }

      if (completed.value) {
        return h('button', {
          class: 'gentorial-preferences__trigger',
          type: 'button',
          onClick: openPreferences
        }, '个性化设置')
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
