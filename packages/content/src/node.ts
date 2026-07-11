import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import {
  courseManifestSchema,
  type ConceptSpec,
  type CourseDefinition,
  type CourseManifest,
  type GenerateSpec,
  type ValidationDiagnostic
} from '@gentorial/core'
import { parseLessonSource } from './parser.js'

export type CompileCourseDirectoryOptions = {
  rootDir: string
  course: CourseDefinition
}

export type CompiledCourseDirectory = {
  manifest: CourseManifest
  diagnostics: ValidationDiagnostic[]
  files: string[]
}

async function findMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await findMarkdownFiles(entryPath)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(entryPath)
  }

  return files
}

function portablePath(path: string): string {
  return path.split(sep).join('/')
}

function duplicateDiagnostic(
  id: string,
  current: ConceptSpec | GenerateSpec,
  previous: ConceptSpec | GenerateSpec
): ValidationDiagnostic {
  return {
    severity: 'error',
    code: 'CONTENT_DUPLICATE_ID',
    message: `ID ${id} 已在 ${previous.source.file}:${previous.source.line} 定义`,
    source: current.source
  }
}

export async function compileCourseDirectory(
  options: CompileCourseDirectoryOptions
): Promise<CompiledCourseDirectory> {
  const rootDir = resolve(options.rootDir)
  const contentDir = resolve(rootDir, options.course.contentDir)
  const paths = await findMarkdownFiles(contentDir)
  const hash = createHash('sha256')
  const concepts: ConceptSpec[] = []
  const generates: GenerateSpec[] = []
  const diagnostics: ValidationDiagnostic[] = []

  for (const path of paths) {
    const sourceText = await readFile(path, 'utf8')
    const file = portablePath(relative(rootDir, path))
    hash.update(file)
    hash.update('\0')
    hash.update(sourceText)
    hash.update('\0')

    const parsed = parseLessonSource(sourceText, { file })
    concepts.push(...parsed.concepts)
    generates.push(...parsed.generates)
    diagnostics.push(...parsed.diagnostics)
  }

  const allById = new Map<string, ConceptSpec | GenerateSpec>()
  for (const item of [...concepts, ...generates]) {
    const previous = allById.get(item.id)
    if (previous) diagnostics.push(duplicateDiagnostic(item.id, item, previous))
    else allById.set(item.id, item)
  }

  const conceptIds = new Set(concepts.map((concept) => concept.id))
  for (const generate of generates) {
    for (const conceptId of generate.concepts) {
      if (!conceptIds.has(conceptId)) {
        diagnostics.push({
          severity: 'error',
          code: 'CONTENT_UNKNOWN_CONCEPT',
          message: `生成区块 ${generate.id} 引用了不存在的概念 ${conceptId}`,
          source: generate.source
        })
      }
    }
  }

  const { plugins, ...serializableCourse } = options.course
  const manifest = courseManifestSchema.parse({
    schemaVersion: '1',
    course: {
      ...serializableCourse,
      ...(plugins
        ? { plugins: plugins.map((plugin) => ({ name: plugin.name, version: plugin.version })) }
        : {})
    },
    concepts,
    generates,
    contentHash: hash.digest('hex')
  })

  return {
    manifest,
    diagnostics,
    files: paths.map((path) => portablePath(relative(rootDir, path)))
  }
}
