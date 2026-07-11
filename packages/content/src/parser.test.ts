import { describe, expect, it } from 'vitest'
import { parseLessonSource } from './index.js'

describe('parseLessonSource', () => {
  it('parses concepts and generate blocks with source locations', () => {
    const source = [
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
      source: { file: 'content/index.md', line: 1 }
    })
    expect(parsed.generates[0]).toMatchObject({
      id: 'switch-range',
      kind: 'example',
      concepts: ['switch-discrete'],
      source: { line: 5 }
    })
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
