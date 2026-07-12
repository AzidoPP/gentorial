import {
  conceptSpecSchema,
  generateSpecSchema,
  type ConceptSpec,
  type GenerateSpec,
  type SourceLocation,
  type ValidationDiagnostic
} from '@gentorial/core'

export type ParseLessonSourceOptions = {
  file?: string
}

export type ParsedLessonSource = {
  concepts: ConceptSpec[]
  generates: GenerateSpec[]
  diagnostics: ValidationDiagnostic[]
}

type DirectiveKind = 'concept' | 'generate'

type DirectiveStart = {
  kind: DirectiveKind
  id: string
  metadata: string
  source: SourceLocation
}

type ParsedMetadata = {
  values: Map<string, string>
  diagnostics: ValidationDiagnostic[]
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type MarkdownHeading = {
  heading: string
  level: HeadingLevel
  lineIndex: number
  source: SourceLocation
}

type MarkdownFence = {
  marker: '`' | '~'
  length: number
}

const directiveStartPattern = /^\s*:::\s+(concept|generate)\s+([^\s]+)(?:\s+(.*?))?\s*$/
const directiveEndPattern = /^\s*:::\s*$/
const fencePattern = /^( {0,3})(`{3,}|~{3,})(.*)$/
const atxHeadingPattern = /^( {0,3})(#{1,6})(?:[\t ]+(.*?)[\t ]*|[\t ]*)$/
const generateKinds = new Set([
  'explanation',
  'example',
  'comparison',
  'exercise',
  'feedback'
])

function diagnostic(
  severity: ValidationDiagnostic['severity'],
  code: string,
  message: string,
  source: SourceLocation
): ValidationDiagnostic {
  return { severity, code, message, source }
}

function parseMetadata(input: string, source: SourceLocation): ParsedMetadata {
  const values = new Map<string, string>()
  const diagnostics: ValidationDiagnostic[] = []
  let index = 0

  while (index < input.length) {
    while (index < input.length && /\s/.test(input[index] ?? '')) index += 1
    if (index >= input.length) break

    const keyMatch = /^[A-Za-z][\w-]*/.exec(input.slice(index))
    if (!keyMatch) {
      diagnostics.push(
        diagnostic('error', 'CONTENT_INVALID_METADATA', `无法解析元信息：${input.slice(index)}`, source)
      )
      break
    }

    const key = keyMatch[0]
    index += key.length

    if (input[index] !== '=') {
      diagnostics.push(
        diagnostic('error', 'CONTENT_INVALID_METADATA', `元信息 ${key} 缺少“=”`, source)
      )
      break
    }
    index += 1

    let value = ''
    const quote = input[index]
    if (quote === '"' || quote === "'") {
      index += 1
      let closed = false
      while (index < input.length) {
        const character = input[index]
        if (character === '\\' && index + 1 < input.length) {
          value += input[index + 1]
          index += 2
          continue
        }
        if (character === quote) {
          index += 1
          closed = true
          break
        }
        value += character
        index += 1
      }
      if (!closed) {
        diagnostics.push(
          diagnostic('error', 'CONTENT_INVALID_METADATA', `元信息 ${key} 的引号未闭合`, source)
        )
        break
      }
    } else {
      const valueMatch = /^\S+/.exec(input.slice(index))
      if (!valueMatch) {
        diagnostics.push(
          diagnostic('error', 'CONTENT_INVALID_METADATA', `元信息 ${key} 缺少值`, source)
        )
        break
      }
      value = valueMatch[0]
      index += value.length
    }

    if (values.has(key)) {
      diagnostics.push(
        diagnostic('error', 'CONTENT_DUPLICATE_METADATA', `元信息 ${key} 重复出现`, source)
      )
    } else {
      values.set(key, value)
    }
  }

  return { values, diagnostics }
}

function startFromLine(line: string, lineNumber: number, file: string): DirectiveStart | undefined {
  const match = directiveStartPattern.exec(line)
  if (!match) return undefined

  const leadingWhitespace = line.length - line.trimStart().length
  return {
    kind: match[1] as DirectiveKind,
    id: match[2] ?? '',
    metadata: match[3] ?? '',
    source: {
      file,
      line: lineNumber,
      column: leadingWhitespace + 1
    }
  }
}

function headingFromLine(
  line: string,
  lineIndex: number,
  file: string
): MarkdownHeading | undefined {
  const match = atxHeadingPattern.exec(line)
  if (!match) return undefined

  const indentation = match[1] ?? ''
  const markers = match[2] ?? ''
  const rawHeading = match[3] ?? ''
  const heading = rawHeading.replace(/[\t ]+#+[\t ]*$/, '').trim()

  return {
    heading,
    level: markers.length as HeadingLevel,
    lineIndex,
    source: {
      file,
      line: lineIndex + 1,
      column: indentation.length + 1
    }
  }
}

function fenceFromLine(line: string): MarkdownFence | undefined {
  const match = fencePattern.exec(line)
  const markers = match?.[2]
  if (!markers) return undefined

  const marker = markers[0]
  if (marker !== '`' && marker !== '~') return undefined
  if (marker === '`' && (match?.[3] ?? '').includes('`')) return undefined

  return { marker, length: markers.length }
}

function closesFence(line: string, fence: MarkdownFence): boolean {
  const match = fencePattern.exec(line)
  const markers = match?.[2]
  if (!markers || markers[0] !== fence.marker || markers.length < fence.length) return false
  return /^[\t ]*$/.test(match?.[3] ?? '')
}

function sectionMarkdown(lines: string[], startIndex: number, endIndex: number): string {
  const authorLines: string[] = []
  let fence: MarkdownFence | undefined
  let conceptContainer = false

  for (let index = startIndex; index < endIndex; index += 1) {
    const line = lines[index] ?? ''
    if (fence) {
      authorLines.push(line)
      if (closesFence(line, fence)) fence = undefined
      continue
    }

    const openingFence = fenceFromLine(line)
    if (openingFence) {
      fence = openingFence
      authorLines.push(line)
      continue
    }

    const directiveMatch = directiveStartPattern.exec(line)
    if (!conceptContainer && directiveMatch?.[1] === 'concept') {
      conceptContainer = true
      continue
    }
    if (conceptContainer && directiveEndPattern.test(line)) {
      conceptContainer = false
      continue
    }

    authorLines.push(line)
  }

  return authorLines.join('\n').trim()
}

function validateMetadataKeys(
  start: DirectiveStart,
  metadata: ParsedMetadata,
  allowedKeys: ReadonlySet<string>
): void {
  for (const key of metadata.values.keys()) {
    if (!allowedKeys.has(key)) {
      metadata.diagnostics.push(
        diagnostic(
          'error',
          'CONTENT_UNKNOWN_METADATA',
          `${start.kind} 指令不支持元信息 ${key}`,
          start.source
        )
      )
    }
  }
}

export function parseLessonSource(
  sourceText: string,
  options: ParseLessonSourceOptions = {}
): ParsedLessonSource {
  const file = options.file ?? '<memory>'
  const lines = sourceText.split(/\r?\n/)
  const concepts: ConceptSpec[] = []
  const generates: GenerateSpec[] = []
  const diagnostics: ValidationDiagnostic[] = []
  const sectionMarkdownByHeadingLine = new Map<number, string>()
  const sourceAfterGenerateReported = new Set<number>()
  let fence: MarkdownFence | undefined
  let heading: MarkdownHeading | undefined
  let generatedHeadingLine: number | undefined

  function reportSourceAfterGenerate(lineIndex: number): void {
    if (!heading || generatedHeadingLine !== heading.lineIndex) return
    if (sourceAfterGenerateReported.has(heading.lineIndex)) return
    sourceAfterGenerateReported.add(heading.lineIndex)
    diagnostics.push(
      diagnostic(
        'error',
        'CONTENT_SOURCE_AFTER_GENERATE',
        '章节的作者原文必须写在 generate 指令之前，才能保证生成结果位于原文之后',
        { file, line: lineIndex + 1, column: 1 }
      )
    )
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (fence) {
      if (closesFence(line, fence)) fence = undefined
      continue
    }

    const openingFence = fenceFromLine(line)
    if (openingFence) {
      reportSourceAfterGenerate(index)
      fence = openingFence
      continue
    }

    const nextHeading = headingFromLine(line, index, file)
    if (nextHeading) {
      heading = nextHeading
      generatedHeadingLine = undefined
      continue
    }

    const start = startFromLine(line, index + 1, file)
    if (!start) {
      if (line.trim()) reportSourceAfterGenerate(index)
      continue
    }
    if (start.kind !== 'generate') reportSourceAfterGenerate(index)

    const bodyLines: string[] = []
    let closingIndex = -1
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const bodyLine = lines[cursor] ?? ''
      if (directiveEndPattern.test(bodyLine)) {
        closingIndex = cursor
        break
      }
      if (startFromLine(bodyLine, cursor + 1, file)) {
        diagnostics.push(
          diagnostic(
            'error',
            'CONTENT_NESTED_DIRECTIVE',
            '首版不允许 Gentorial 指令相互嵌套',
            { file, line: cursor + 1, column: 1 }
          )
        )
      }
      bodyLines.push(bodyLine)
    }

    if (closingIndex < 0) {
      diagnostics.push(
        diagnostic(
          'error',
          'CONTENT_UNCLOSED_DIRECTIVE',
          `${start.kind} 指令 ${start.id} 未闭合`,
          start.source
        )
      )
      break
    }

    index = closingIndex
    const body = bodyLines.join('\n').trim()
    const metadata = parseMetadata(start.metadata, start.source)

    if (start.kind === 'concept') {
      validateMetadataKeys(start, metadata, new Set(['title']))
      diagnostics.push(...metadata.diagnostics)
      const title = metadata.values.get('title')
      const candidate = {
        id: start.id,
        statement: body,
        source: start.source,
        ...(title ? { title } : {})
      }
      const result = conceptSpecSchema.safeParse(candidate)
      if (result.success) concepts.push(result.data)
      else {
        diagnostics.push(
          diagnostic(
            'error',
            'CONTENT_INVALID_CONCEPT',
            result.error.issues.map((issue) => issue.message).join('；'),
            start.source
          )
        )
      }
      continue
    }

    generatedHeadingLine = heading?.lineIndex

    validateMetadataKeys(start, metadata, new Set(['kind', 'concepts']))
    diagnostics.push(...metadata.diagnostics)
    const kind = metadata.values.get('kind')
    const conceptIds = (metadata.values.get('concepts') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    let markdown: string | undefined
    if (!heading) {
      diagnostics.push(
        diagnostic(
          'error',
          'CONTENT_GENERATE_WITHOUT_HEADING',
          `generate 指令 ${start.id} 前没有可绑定的 Markdown 标题`,
          start.source
        )
      )
    } else {
      if (!sectionMarkdownByHeadingLine.has(heading.lineIndex)) {
        sectionMarkdownByHeadingLine.set(
          heading.lineIndex,
          sectionMarkdown(lines, heading.lineIndex + 1, start.source.line - 1)
        )
      }
      markdown = sectionMarkdownByHeadingLine.get(heading.lineIndex)
      if (!markdown) {
        diagnostics.push(
          diagnostic(
            'error',
            'CONTENT_EMPTY_GENERATION_SCOPE',
            `generate 指令 ${start.id} 所绑定的章节范围为空`,
            start.source
          )
        )
      }
    }

    if (!kind || !generateKinds.has(kind)) {
      diagnostics.push(
        diagnostic(
          'error',
          'CONTENT_INVALID_GENERATE_KIND',
          `generate 指令 ${start.id} 的 kind 无效或缺失`,
          start.source
        )
      )
      continue
    }

    if (!heading || !markdown) continue

    const result = generateSpecSchema.safeParse({
      id: start.id,
      kind,
      prompt: body,
      concepts: conceptIds,
      source: start.source,
      scope: {
        type: 'section',
        id: `${start.id}-scope`,
        heading: heading.heading,
        level: heading.level,
        markdown,
        source: heading.source
      },
      trigger: {
        type: 'heading',
        source: heading.source
      },
      output: {
        placement: 'after-source',
        mode: 'replace'
      }
    })
    if (result.success) generates.push(result.data)
    else {
      diagnostics.push(
        diagnostic(
          'error',
          'CONTENT_INVALID_GENERATE',
          result.error.issues.map((issue) => issue.message).join('；'),
          start.source
        )
      )
    }
  }

  const seenIds = new Map<string, SourceLocation>()
  for (const item of [...concepts, ...generates]) {
    const previous = seenIds.get(item.id)
    if (previous) {
      diagnostics.push(
        diagnostic(
          'error',
          'CONTENT_DUPLICATE_ID',
          `ID ${item.id} 已在 ${previous.file}:${previous.line} 定义`,
          item.source
        )
      )
    } else {
      seenIds.set(item.id, item.source)
    }
  }

  return { concepts, generates, diagnostics }
}
