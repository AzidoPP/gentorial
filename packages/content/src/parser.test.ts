import { describe, expect, it } from 'vitest'
import { parseLessonSource } from './index.js'

describe('parseLessonSource', () => {
  it('parses concepts and generate blocks with source locations', () => {
    const source = [
      '## switch 语句',
      '',
      '::: concept switch-discrete title="switch 的适用边界"',
      '`switch` 根据离散结果选择分支。',
      ':::',
      '',
      '::: generate switch-range kind=example concepts=switch-discrete',
      '不要用 switch 直接判断连续范围。',
      ':::'
    ].join('\r\n')

    const parsed = parseLessonSource(source, { file: 'content/index.md' })

    expect(parsed.diagnostics).toEqual([])
    expect(parsed.concepts[0]).toMatchObject({
      id: 'switch-discrete',
      title: 'switch 的适用边界',
      source: { file: 'content/index.md', line: 3 }
    })
    expect(parsed.generates[0]).toMatchObject({
      id: 'switch-range',
      kind: 'example',
      concepts: ['switch-discrete'],
      source: { line: 7 },
      scope: {
        type: 'section',
        id: 'switch-range-scope',
        heading: 'switch 语句',
        level: 2,
        markdown: '`switch` 根据离散结果选择分支。',
        source: { file: 'content/index.md', line: 1, column: 1 }
      },
      trigger: {
        type: 'heading',
        source: { file: 'content/index.md', line: 1, column: 1 }
      },
      output: { placement: 'after-source', mode: 'replace' }
    })
  })

  it('binds a generation without concepts to its nearest heading section', () => {
    const source = [
      '# 在开始编程之前',
      '',
      '```md',
      '### 这不是标题',
      ':::',
      '```',
      '',
      '### 发展历史',
      '',
      '1. ALGOL CPL BCPL',
      '2. B',
      '3. C',
      '',
      '::: generate c-history kind=explanation',
      '沿语言演化链解释 C 的形成过程。',
      ':::'
    ].join('\n')

    const parsed = parseLessonSource(source, { file: 'content/c.md' })

    expect(parsed.diagnostics).toEqual([])
    expect(parsed.generates).toEqual([
      expect.objectContaining({
        id: 'c-history',
        concepts: [],
        source: { file: 'content/c.md', line: 14, column: 1 },
        scope: {
          type: 'section',
          id: 'c-history-scope',
          heading: '发展历史',
          level: 3,
          markdown: '1. ALGOL CPL BCPL\n2. B\n3. C',
          source: { file: 'content/c.md', line: 8, column: 1 }
        },
        trigger: {
          type: 'heading',
          source: { file: 'content/c.md', line: 8, column: 1 }
        },
        output: { placement: 'after-source', mode: 'replace' }
      })
    ])
  })

  it('shares the first author scope between multiple generations in a section', () => {
    const source = [
      '## 分支',
      '',
      '::: concept stable',
      '作者给出的范围。',
      ':::',
      '',
      '::: generate explain kind=explanation',
      '解释它。',
      ':::',
      '',
      '::: generate exercise kind=exercise',
      '出一道题。',
      ':::'
    ].join('\n')

    const parsed = parseLessonSource(source)

    expect(parsed.diagnostics).toEqual([])
    expect(parsed.generates.map((generate) => generate.scope.markdown)).toEqual([
      '作者给出的范围。',
      '作者给出的范围。'
    ])
  })

  it('rejects author source placed after a generate directive in the same section', () => {
    const parsed = parseLessonSource([
      '## 顺序约束',
      '',
      '作者范围。',
      '',
      '::: generate explain kind=explanation',
      '解释它。',
      ':::',
      '',
      '这行放得太晚。'
    ].join('\n'))

    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CONTENT_SOURCE_AFTER_GENERATE', severity: 'error' })
    )
  })

  it('reports generations without a heading or an author scope', () => {
    const withoutHeading = parseLessonSource(
      '::: generate no-heading kind=explanation\n解释它。\n:::'
    )
    const emptyScope = parseLessonSource(
      '### 空章节\n\n::: generate empty kind=explanation\n解释它。\n:::'
    )

    expect(withoutHeading.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CONTENT_GENERATE_WITHOUT_HEADING', severity: 'error' })
    )
    expect(emptyScope.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CONTENT_EMPTY_GENERATION_SCOPE', severity: 'error' })
    )
    expect(withoutHeading.generates).toEqual([])
    expect(emptyScope.generates).toEqual([])
  })

  it('reports an unclosed directive', () => {
    const parsed = parseLessonSource('::: concept broken\n正文')

    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CONTENT_UNCLOSED_DIRECTIVE', severity: 'error' })
    )
  })

  it('ignores directive-looking text inside fenced code', () => {
    const parsed = parseLessonSource('```md\n::: concept not-a-directive\n:::\n```')

    expect(parsed.concepts).toEqual([])
    expect(parsed.diagnostics).toEqual([])
  })

  it('reports metadata that is not part of the directive protocol', () => {
    const parsed = parseLessonSource('::: concept stable hidden=true\n正文\n:::')

    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CONTENT_UNKNOWN_METADATA', severity: 'error' })
    )
  })
})
