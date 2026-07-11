import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { installGentorialMarkdown } from './index.js'

describe('installGentorialMarkdown', () => {
  it('renders concept anchors into static HTML', () => {
    const markdown = new MarkdownIt()
    installGentorialMarkdown(markdown)

    const html = markdown.render([
      '::: concept switch-discrete title="switch 的适用边界"',
      '`switch` 根据离散结果选择分支。',
      ':::'
    ].join('\n'))

    expect(html).toContain('data-concept-id="switch-discrete"')
    expect(html).toContain('<h3>switch 的适用边界</h3>')
    expect(html).toContain('<code>switch</code>')
  })

  it('escapes directive metadata before writing HTML', () => {
    const markdown = new MarkdownIt()
    installGentorialMarkdown(markdown)

    const html = markdown.render('::: concept safe title="<script>bad</script>"\ntext\n:::')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('turns a validated generate directive into a controlled Vue component', () => {
    const markdown = new MarkdownIt()
    installGentorialMarkdown(markdown)

    const html = markdown.render([
      '::: concept switch-discrete',
      '离散概念。',
      ':::',
      '',
      '::: generate switch-range kind=example concepts=switch-discrete',
      '生成示例。',
      ':::'
    ].join('\n'))

    expect(html).toContain('<GentorialGenerate')
    expect(html).toContain('&quot;id&quot;:&quot;switch-range&quot;')
    expect(html).toContain('静态回退')
  })
})
