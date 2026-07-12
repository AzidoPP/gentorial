import MarkdownIt from 'markdown-it'
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress'
import { afterEach, describe, expect, it } from 'vitest'
import { installGentorialMarkdown } from './index.js'

afterEach(() => disposeMdItInstance())

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
      '## 连续范围',
      '',
      '::: concept switch-discrete',
      '离散概念。',
      ':::',
      '',
      '::: generate switch-range kind=example concepts=switch-discrete',
      '生成示例。',
      ':::'
    ].join('\n'))

    expect(html).toContain('<GentorialGenerateTrigger generate-id="switch-range"')
    expect(html).toContain('label="连续范围"')
    expect(html).toContain('<GentorialGeneratedRegion')
    expect(html).toContain('&quot;id&quot;:&quot;switch-range&quot;')
    expect(html).toContain('静态回退')
    expect(html.indexOf('GentorialGenerateTrigger')).toBeLessThan(html.indexOf('离散概念'))
    expect(html.indexOf('离散概念')).toBeLessThan(html.indexOf('GentorialGeneratedRegion'))
  })

  it('keeps absolute build-machine paths out of client props', () => {
    const markdown = new MarkdownIt()
    installGentorialMarkdown(markdown)
    const source = [
      '## C 的历史',
      '',
      '1. ALGOL、CPL、BCPL',
      '2. B',
      '3. C',
      '',
      '::: generate c-history kind=explanation',
      '沿演化链解释 C 的形成。',
      ':::'
    ].join('\n')

    const html = markdown.render(source, {
      path: 'D:/private/workspace/content/index.md',
      relativePath: 'guide/index.md'
    })

    expect(html).toContain('guide/index.md')
    expect(html).not.toContain('D:/private')
  })

  it('preserves VitePress header extraction after adding heading triggers', async () => {
    disposeMdItInstance()
    const markdown = await createMarkdownRenderer(process.cwd(), {
      headers: true,
      config: installGentorialMarkdown
    })
    const environment: Record<string, unknown> = {
      path: 'D:/private/content/index.md',
      relativePath: 'index.md'
    }

    markdown.render([
      '# 页面',
      '',
      '## C 的历史',
      '',
      '1. ALGOL、CPL、BCPL',
      '2. B',
      '3. C',
      '',
      '::: generate c-history kind=explanation',
      '沿演化链解释 C 的形成。',
      ':::',
      '',
      '## 普通标题',
      '',
      '普通正文。'
    ].join('\n'), environment)

    expect(environment.headers).toEqual([
      expect.objectContaining({ level: 2, title: 'C 的历史', slug: 'c-的历史' }),
      expect.objectContaining({ level: 2, title: '普通标题', slug: '普通标题' })
    ])
  })
})
