import type { VNode, VNodeChild } from 'vue'
import { describe, expect, it } from 'vitest'
import { gentorialMarkdownAsText, renderGentorialMarkdown } from './markdown.js'

function nodes(children: VNodeChild[]): VNode[] {
  return children.flatMap((child): VNode[] => {
    if (Array.isArray(child)) return nodes(child)
    return typeof child === 'object' && child !== null && '__v_isVNode' in child
      ? [child as VNode]
      : []
  })
}

describe('Gentorial runtime Markdown', () => {
  it('renders standard Markdown structure as Vue nodes', () => {
    const rendered = nodes(renderGentorialMarkdown([
      '## 标题',
      '',
      '包含 **重点**、`代码` 与 [链接](https://example.com)。',
      '',
      '- 第一项',
      '- 第二项',
      '',
      '```ts',
      'const answer = 42',
      '```'
    ].join('\n')))

    expect(rendered.map((node) => node.type)).toEqual(['h2', 'p', 'ul', 'pre'])
    const paragraph = rendered[1]!
    expect(nodes(paragraph.children as VNodeChild[]).map((node) => node.type)).toEqual([
      'strong', 'code', 'a'
    ])
    expect(nodes(rendered[2]!.children as VNodeChild[]).map((node) => node.type)).toEqual([
      'li', 'li'
    ])
  })

  it('keeps raw HTML inert and produces plain text for copy', () => {
    const source = '<script>alert(1)</script>\n\n**安全文本**'
    const rendered = nodes(renderGentorialMarkdown(source))

    expect(rendered.map((node) => node.type)).toEqual(['p', 'p'])
    expect(gentorialMarkdownAsText(source)).toContain('<script>alert(1)</script>')
    expect(gentorialMarkdownAsText(source)).toContain('安全文本')
    expect(gentorialMarkdownAsText('包含 **重点** 与 `代码`。')).toBe('包含 重点 与 代码。')
  })
})
