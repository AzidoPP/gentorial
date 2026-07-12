import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import markdownItContainer from 'markdown-it-container'
import { parseLessonSource, type ParsedLessonSource } from '@gentorial/content'
import type { LessonBlock } from '@gentorial/core'

type DirectiveInfo = {
  id: string
  attributes: Map<string, string>
}

function parseInfo(info: string): DirectiveInfo {
  const trimmed = info.trim()
  const idMatch = /^([^\s]+)/.exec(trimmed)
  const id = idMatch?.[1] ?? ''
  const attributes = new Map<string, string>()
  const rest = trimmed.slice(id.length)
  const pattern = /([A-Za-z][\w-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(rest))) {
    attributes.set(match[1] ?? '', match[2] ?? match[3] ?? match[4] ?? '')
  }

  return { id, attributes }
}

const parsedSourceKey = '__gentorialParsedSource'

function parsedSourceFromEnvironment(environment: unknown): ParsedLessonSource | undefined {
  if (typeof environment !== 'object' || environment === null) return undefined
  return Reflect.get(environment, parsedSourceKey) as ParsedLessonSource | undefined
}

function expressionAttribute(md: MarkdownIt, value: unknown): string {
  return md.utils.escapeHtml(JSON.stringify(value))
}

function sourcePathFromEnvironment(environment: Record<string, unknown>): string {
  return typeof environment.relativePath === 'string'
    ? environment.relativePath.replaceAll('\\', '/')
    : '<markdown>'
}

function openTokenInfo(tokens: Token[], index: number): DirectiveInfo {
  const token = tokens[index]
  return parseInfo((token?.info ?? '').trim().replace(/^(concept|generate)\s+/, ''))
}

export function installGentorialMarkdown(md: MarkdownIt): void {
  md.core.ruler.before('block', 'gentorial_parse_source', (state) => {
    const environment = state.env as Record<string, unknown>
    const file = sourcePathFromEnvironment(environment)
    const parsed = parseLessonSource(state.src, { file })
    environment[parsedSourceKey] = parsed

    const error = parsed.diagnostics.find((item) => item.severity === 'error')
    if (error) {
      const location = error.source ? `${error.source.file}:${error.source.line}` : file
      throw new Error(`${location} [${error.code}] ${error.message}`)
    }
  })

  md.core.ruler.after('inline', 'gentorial_heading_triggers', (state) => {
    const parsed = parsedSourceFromEnvironment(state.env)
    if (!parsed) return

    for (const generate of parsed.generates) {
      const headingLine = generate.trigger.source.line - 1
      const headingIndex = state.tokens.findIndex(
        (token) => token.type === 'heading_open' && token.map?.[0] === headingLine
      )
      const inline = headingIndex >= 0 ? state.tokens[headingIndex + 1] : undefined
      if (!inline || inline.type !== 'inline' || !inline.children) {
        throw new Error(
          `${generate.trigger.source.file}:${generate.trigger.source.line} ` +
            `无法把生成触发器 ${generate.id} 绑定到标题`
        )
      }

      const trigger = new state.Token('html_inline', '', 0)
      trigger.content =
        ` <GentorialGenerateTrigger generate-id="${md.utils.escapeHtml(generate.id)}"` +
        ` label="${md.utils.escapeHtml(generate.scope.heading)}" />`
      inline.children.push(trigger)
    }
  })

  md.use(markdownItContainer, 'concept', {
    validate(parameters: string) {
      return /^\s*concept\s+[^\s]+/.test(parameters)
    },
    render(tokens: Token[], index: number) {
      if (tokens[index]?.nesting === -1) return '</section>\n'

      const info = openTokenInfo(tokens, index)
      const id = md.utils.escapeHtml(info.id)
      const title = info.attributes.get('title')
      return [
        `<section class="gentorial-concept" data-concept-id="${id}">`,
        title ? `<h3>${md.utils.escapeHtml(title)}</h3>` : ''
      ].join('')
    }
  })

  md.use(markdownItContainer, 'generate', {
    validate(parameters: string) {
      return /^\s*generate\s+[^\s]+/.test(parameters)
    },
    render(tokens: Token[], index: number, _options: unknown, environment: unknown) {
      if (tokens[index]?.nesting === -1) return '</GentorialGeneratedRegion>\n'

      const info = openTokenInfo(tokens, index)
      const parsed = parsedSourceFromEnvironment(environment)
      const generate = parsed?.generates.find((item) => item.id === info.id)
      if (!generate) {
        throw new Error(`无法从已校验的页面清单中找到生成区块 ${info.id}`)
      }
      const conceptIds = new Set(generate.concepts)
      const concepts = parsed?.concepts.filter((concept) => conceptIds.has(concept.id)) ?? []
      const fallback: LessonBlock[] = [
        {
          type: 'callout',
          tone: 'info',
          title: '静态回退',
          text: '个性化讲解暂时不可用；上方作者原文仍可正常阅读。'
        }
      ]
      return [
        `<GentorialGeneratedRegion :spec="${expressionAttribute(md, generate)}"`,
        ` :concepts="${expressionAttribute(md, concepts)}"`,
        ` :fallback="${expressionAttribute(md, fallback)}">`
      ].join('')
    }
  })
}
