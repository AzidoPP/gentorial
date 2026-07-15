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

  it('renders raw HTML only when the course explicitly enables it', () => {
    const inline = nodes(
      renderGentorialMarkdown('前缀 <mark onclick="run()">原始 HTML</mark> 后缀', {
        allowUnsafeHtml: true
      })
    )[0]!
    const inlineHtml = nodes(inline.children as VNodeChild[])[0]!
    expect(inlineHtml.props?.innerHTML).toContain('<mark onclick="run()">原始 HTML</mark>')

    const block = nodes(
      renderGentorialMarkdown('<section data-generated="true">区块</section>', {
        allowUnsafeHtml: true
      })
    )[0]!
    expect(block.props?.innerHTML).toContain('<section data-generated="true">区块</section>')
  })

  it('preserves Markdown table structure and safe column alignment', () => {
    const rendered = nodes(
      renderGentorialMarkdown(
        [
          '| 记录 | 判断 | 对总分的影响 | 对有效人数的影响 |',
          '| :--- | :---: | ---: | ---: |',
          '| 85 | 有效 | +85 | +1 |',
          '| 缺考 | 不计入 | +0 | +0 |'
        ].join('\n')
      )
    )

    expect(rendered).toHaveLength(1)
    expect(rendered[0]?.type).toBe('table')
    const sections = nodes(rendered[0]?.children as VNodeChild[])
    expect(sections.map((node) => node.type)).toEqual(['thead', 'tbody'])
    const headerRow = nodes(sections[0]?.children as VNodeChild[])[0]!
    const headers = nodes(headerRow.children as VNodeChild[])
    expect(headers).toHaveLength(4)
    expect(headers[0]?.props?.style).toEqual({ textAlign: 'left' })
    expect(headers[1]?.props?.style).toEqual({ textAlign: 'center' })
    expect(headers[2]?.props?.style).toEqual({ textAlign: 'right' })
    const bodyRows = nodes(sections[1]?.children as VNodeChild[])
    expect(bodyRows).toHaveLength(2)
    expect(nodes(bodyRows[0]?.children as VNodeChild[])).toHaveLength(4)
  })
})
