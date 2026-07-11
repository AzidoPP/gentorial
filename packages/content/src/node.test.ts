import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { defineCourse } from '@gentorial/core'
import { afterEach, describe, expect, it } from 'vitest'
import { compileCourseDirectory } from './node.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('compileCourseDirectory', () => {
  it('creates a stable manifest and diagnoses unknown concept references', async () => {
    const rootDir = await mkdtemp(resolve(tmpdir(), 'gentorial-content-'))
    temporaryDirectories.push(rootDir)
    await mkdir(resolve(rootDir, 'content'))
    await writeFile(
      resolve(rootDir, 'content/index.md'),
      '::: generate example kind=example concepts=missing\n生成示例。\n:::',
      'utf8'
    )

    const result = await compileCourseDirectory({
      rootDir,
      course: defineCourse({
        schemaVersion: '1',
        id: 'fixture',
        title: 'Fixture',
        lang: 'zh-CN',
        contentDir: 'content',
        generation: { mode: 'snapshot', defaultLocale: 'zh-CN' },
        accuracy: { policies: [] }
      })
    })

    expect(result.manifest.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.files).toEqual(['content/index.md'])
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CONTENT_UNKNOWN_CONCEPT', severity: 'error' })
    )
  })
})
