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

const directiveStartPattern = /^\s*:::\s+(concept|generate)\s+([^\s]+)(?:\s+(.*?))?\s*$/
const directiveEndPattern = /^\s*:::\s*$/
const fencePattern = /^\s*(```+|~~~+)/
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
  let fence: string | undefined

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const fenceMatch = fencePattern.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0]
      if (!fence) fence = marker
      else if (marker === fence) fence = undefined
      continue
    }
    if (fence) continue

    const start = startFromLine(line, index + 1, file)
    if (!start) continue

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

    validateMetadataKeys(start, metadata, new Set(['kind', 'concepts']))
    diagnostics.push(...metadata.diagnostics)
    const kind = metadata.values.get('kind')
    const conceptIds = (metadata.values.get('concepts') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

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

    const result = generateSpecSchema.safeParse({
      id: start.id,
      kind,
      prompt: body,
      concepts: conceptIds,
      source: start.source
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
