import type {
  ConceptSpec,
  GenerateSpec,
  LessonBlock
} from '@gentorial/core'
import {
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  ref,
  type PropType,
  type VNodeChild
} from 'vue'
import { gentorialRuntimeKey } from './runtime.js'

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
      type: Array as PropType<LessonBlock[]>,
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
      type: Object as PropType<Record<string, unknown>>,
      required: false
    },
    fallback: {
      type: Array as PropType<LessonBlock[]>,
      default: () => []
    }
  },
  setup(props) {
    const runtime = inject(gentorialRuntimeKey)
    const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
    const blocks = ref<LessonBlock[]>([])
    const errorMessage = ref('')
    let controller: AbortController | undefined

    async function generate() {
      controller?.abort()
      const requestController = new AbortController()
      controller = requestController
      status.value = 'loading'
      errorMessage.value = ''

      try {
        if (!runtime) throw new Error('Gentorial runtime has not been installed')
        const lesson = await runtime.generate(
          {
            generate: props.spec,
            concepts: props.concepts,
            ...(props.learner ? { learner: props.learner } : {})
          },
          { signal: requestController.signal }
        )
        if (controller !== requestController) return
        blocks.value = lesson.blocks
        status.value = 'success'
      } catch (error) {
        if (controller !== requestController) return
        if (requestController.signal.aborted) {
          status.value = 'idle'
          return
        }
        errorMessage.value = error instanceof Error ? error.message : String(error)
        status.value = 'error'
      }
    }

    onBeforeUnmount(() => controller?.abort())

    return () => {
      const content: VNodeChild[] = []
      if (status.value === 'success') {
        content.push(h(LessonBlockRenderer, { blocks: blocks.value }))
      } else if (status.value === 'error') {
        content.push(
          h('p', { class: 'gentorial-generate__error', role: 'alert' }, errorMessage.value)
        )
        if (props.fallback.length > 0) {
          content.push(h(LessonBlockRenderer, { blocks: props.fallback }))
        }
      } else if (status.value === 'loading') {
        content.push(h('p', { 'aria-live': 'polite' }, '正在生成经过校验的课程内容…'))
      } else if (props.fallback.length > 0) {
        content.push(h(LessonBlockRenderer, { blocks: props.fallback }))
      }

      content.push(
        h(
          'button',
          {
            type: 'button',
            disabled: status.value === 'loading',
            onClick: generate
          },
          status.value === 'loading' ? '生成中…' : status.value === 'success' ? '重新生成' : '生成内容'
        )
      )

      return h(
        'section',
        { class: 'gentorial-generate', 'data-generate-id': props.spec.id },
        content
      )
    }
  }
})
