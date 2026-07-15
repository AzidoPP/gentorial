import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { h, resolveComponent, type VNodeChild } from 'vue'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false
})

type RenderFrame = {
  tag: string
  props?: Record<string, unknown> | undefined
}

function safeUrl(value: string | null): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (/^(?:javascript|vbscript|file):/iu.test(normalized)) return undefined
  if (/^data:/iu.test(normalized) && !/^data:image\/(?:gif|png|jpe?g|webp);/iu.test(normalized)) {
    return undefined
  }
  return normalized
}

function frameFor(token: Token): RenderFrame | undefined {
  if (token.hidden) return undefined
  switch (token.type) {
    case 'paragraph_open':
      return { tag: 'p' }
    case 'heading_open':
      return { tag: token.tag }
    case 'bullet_list_open':
      return { tag: 'ul' }
    case 'ordered_list_open': {
      const start = token.attrGet('start')
      return { tag: 'ol', props: start ? { start: Number(start) } : undefined }
    }
    case 'list_item_open':
      return { tag: 'li' }
    case 'blockquote_open':
      return { tag: 'blockquote' }
    case 'em_open':
      return { tag: 'em' }
    case 'strong_open':
      return { tag: 'strong' }
    case 's_open':
      return { tag: 's' }
    case 'link_open': {
      const href = safeUrl(token.attrGet('href'))
      const title = token.attrGet('title')
      return {
        tag: 'a',
        props: {
          ...(href ? { href } : {}),
          ...(title ? { title } : {})
        }
      }
    }
    default:
      return undefined
  }
}

function closingIndex(tokens: Token[], start: number): number {
  let depth = 0
  for (let index = start; index < tokens.length; index += 1) {
    depth += tokens[index]?.nesting ?? 0
    if (depth === 0) return index
  }
  return tokens.length - 1
}

function renderTokens(tokens: Token[], start = 0, end = tokens.length): VNodeChild[] {
  const children: VNodeChild[] = []

  for (let index = start; index < end; index += 1) {
    const token = tokens[index]
    if (!token) continue

    if (token.nesting === 1) {
      const close = closingIndex(tokens, index)
      const nested = renderTokens(tokens, index + 1, close)
      const frame = frameFor(token)
      children.push(frame ? h(frame.tag, frame.props, nested) : nested)
      index = close
      continue
    }

    switch (token.type) {
      case 'inline':
        children.push(...renderTokens(token.children ?? []))
        break
      case 'text':
        children.push(token.content)
        break
      case 'softbreak':
        children.push('\n')
        break
      case 'hardbreak':
        children.push(h('br'))
        break
      case 'code_inline':
        children.push(h('code', token.content))
        break
      case 'fence': {
        const language = token.info.trim().split(/\s+/u)[0] ?? ''
        if (language === 'mermaid') {
          children.push(h(resolveComponent('GentorialMermaid'), { graph: token.content }))
        } else {
          children.push(h('pre', [
            h('code', { class: language ? `language-${language}` : undefined }, token.content)
          ]))
        }
        break
      }
      case 'code_block':
        children.push(h('pre', [h('code', token.content)]))
        break
      case 'hr':
        children.push(h('hr'))
        break
      case 'image': {
        const src = safeUrl(token.attrGet('src'))
        if (src) {
          children.push(h('img', {
            src,
            alt: token.content,
            ...(token.attrGet('title') ? { title: token.attrGet('title') } : {})
          }))
        } else {
          children.push(token.content)
        }
        break
      }
      default:
        if (token.content) children.push(token.content)
    }
  }

  return children
}

export function renderGentorialMarkdown(source: string): VNodeChild[] {
  return renderTokens(markdown.parse(source, {}))
}

export function gentorialMarkdownAsText(source: string): string {
  const tokens = markdown.parse(source, {})
  return tokens
    .flatMap((token) => {
      if (token.type === 'inline') {
        return [(token.children ?? []).map((child) =>
          child.type === 'softbreak' || child.type === 'hardbreak' ? '\n' : child.content
        ).join('')]
      }
      return token.type === 'fence' || token.type === 'code_block' ? [token.content] : []
    })
    .join('\n\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}
