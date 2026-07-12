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
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
  type VNodeChild
} from 'vue'
import {
  gentorialRuntimeKey,
  type GentorialGenerationStatus
} from './runtime.js'

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
    blocks: {
      type: Array as PropType<readonly LessonBlock[]>,
      required: true
    }
  },
  setup(props) {
    return () => h('div', { class: 'gentorial-lesson-blocks' }, props.blocks.map(renderBlock))
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
    return `取消展开：${subject}`
  }
  if (status === 'success') {
    return `重新展开：${subject}`
  }
  if (status === 'error') {
    return `重试展开：${subject}`
  }
  return `按需展开：${subject}`
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

    function activate(): void {
      if (!runtime) return
      if (state.value?.status === 'loading') {
        runtime.cancel(props.generateId)
      } else {
        void runtime.run(props.generateId)
      }
    }

    return () => {
      const status = state.value?.status ?? 'idle'
      const text = triggerText(status, props.label ?? props.generateId)
      return h(
        'button',
        {
          type: 'button',
          class: ['gentorial-generate-trigger', 'ignore-header'],
          'data-status': status,
          'aria-controls': `gentorial-generated-${props.generateId}`,
          'aria-label': text,
          title: text,
          disabled: !runtime,
          onClick: activate
        },
        h(
          'span',
          { class: 'gentorial-generate-trigger__icon', 'aria-hidden': 'true' },
          status === 'loading' ? '×' : '✦'
        )
      )
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
          ? [h(LessonBlockRenderer, { key: `assistant-${index}`, blocks: turn.lesson.blocks })]
          : []
      )
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
          'data-generate-id': props.spec.id,
          'aria-label': '继续提问',
          'aria-busy': current.status === 'loading' || current.followUpStatus === 'loading'
            ? 'true'
            : undefined
        },
        [
          h(LessonBlockRenderer, { key: 'base', blocks: current.blocks }),
          ...assistantLessons,
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
  setup() {
    const runtime = inject(gentorialRuntimeKey, undefined)

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

    return () =>
      h('details', { class: 'gentorial-preferences' }, [
        h('summary', '个性化学习偏好'),
        h('div', { class: 'gentorial-preferences__fields' }, [
          select('detail', '内容深度', detailOptions),
          select('tone', '表达语气', toneOptions),
          select('narrative', '叙事方式', narrativeOptions)
        ])
      ])
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
