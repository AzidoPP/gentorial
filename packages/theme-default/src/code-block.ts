import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue'

export type GentorialCodeBlockOptions = {
  lineNumbers?: boolean
}

type HighlightedCode = {
  classes: string
  style?: string
  code: string
}

function normalizedLanguage(value: string): string {
  const language = value.trim().toLowerCase()
  return /^[a-z0-9_+#.-]+$/u.test(language) ? language : 'text'
}

function lineCount(code: string): number {
  return code.replace(/\n$/u, '').split('\n').length
}

function highlightedCode(html: string): HighlightedCode | undefined {
  const match = /^<pre\b([^>]*)><code(?:\s[^>]*)?>([\s\S]*)<\/code><\/pre>$/u.exec(html)
  if (!match) return undefined
  const attributes = match[1] ?? ''
  const classes = /\bclass="([^"]*)"/u.exec(attributes)?.[1] ?? 'shiki'
  const style = /\bstyle="([^"]*)"/u.exec(attributes)?.[1]
  return {
    classes: `${classes} vp-code`,
    ...(style ? { style } : {}),
    code: match[2] ?? ''
  }
}

export function createGentorialCodeBlock(options: GentorialCodeBlockOptions = {}) {
  return defineComponent({
    name: 'GentorialCodeBlock',
    props: {
      code: { type: String, required: true },
      language: { type: String, default: '' }
    },
    setup(props) {
      const highlighted = ref<HighlightedCode>()
      const copied = ref(false)
      const language = computed(() => normalizedLanguage(props.language || 'text'))
      let highlightSequence = 0
      let copyTimer: ReturnType<typeof setTimeout> | undefined

      async function highlight(): Promise<void> {
        const sequence = ++highlightSequence
        try {
          const { codeToHtml } = await import('shiki')
          let html: string
          try {
            html = await codeToHtml(props.code, {
              lang: language.value,
              themes: { light: 'github-light', dark: 'github-dark' }
            })
          } catch {
            html = await codeToHtml(props.code, {
              lang: 'text',
              themes: { light: 'github-light', dark: 'github-dark' }
            })
          }
          if (sequence !== highlightSequence) return
          highlighted.value = highlightedCode(html)
        } catch {
          if (sequence === highlightSequence) highlighted.value = undefined
        }
      }

      async function copy(): Promise<void> {
        await navigator.clipboard.writeText(props.code)
        copied.value = true
        if (copyTimer) clearTimeout(copyTimer)
        copyTimer = setTimeout(() => {
          copied.value = false
        }, 2000)
      }

      watch(() => [props.code, props.language] as const, () => void highlight(), {
        immediate: true
      })
      onBeforeUnmount(() => {
        highlightSequence += 1
        if (copyTimer) clearTimeout(copyTimer)
      })

      return () =>
        h(
          'div',
          {
            class: [
              'gentorial-code-block',
              `language-${language.value}`,
              'vp-adaptive-theme',
              options.lineNumbers && 'line-numbers-mode'
            ]
          },
          [
            h('button', {
              type: 'button',
              class: ['copy', copied.value && 'copied'],
              title: copied.value ? '已复制' : '复制代码',
              'aria-label': copied.value ? '已复制' : '复制代码',
              onClick: () => void copy()
            }),
            h('span', { class: 'lang' }, language.value),
            highlighted.value
              ? h(
                  'pre',
                  {
                    class: highlighted.value.classes,
                    style: highlighted.value.style,
                    tabindex: 0
                  },
                  [h('code', { innerHTML: highlighted.value.code })]
                )
              : h('pre', { class: 'vp-code', tabindex: 0 }, [
                  h('code', { class: `language-${language.value}` }, props.code)
                ]),
            ...(options.lineNumbers
              ? [
                  h(
                    'div',
                    { class: 'line-numbers-wrapper', 'aria-hidden': 'true' },
                    Array.from({ length: lineCount(props.code) }, (_, index) => [
                      h('span', { class: 'line-number', key: index }, String(index + 1)),
                      h('br')
                    ])
                  )
                ]
              : [])
          ]
        )
    }
  })
}
