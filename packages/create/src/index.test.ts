import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createGentorialProject, validateProjectName } from './index.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('createGentorialProject', () => {
  it('copies the packaged template and replaces project values', async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), 'gentorial-create-'))
    temporaryDirectories.push(cwd)

    const result = await createGentorialProject({
      cwd,
      targetDir: 'my-course',
      title: '我的课程',
      lang: 'zh-CN',
      allowUnsafeHtml: true
    })
    const packageSource = await readFile(resolve(result.targetDir, 'package.json'), 'utf8')
    const courseSource = await readFile(resolve(result.targetDir, 'course.config.ts'), 'utf8')
    const themeSource = await readFile(
      resolve(result.targetDir, 'docs/.vitepress/theme/index.ts'),
      'utf8'
    )
    const vitepressSource = await readFile(
      resolve(result.targetDir, 'docs/.vitepress/config.ts'),
      'utf8'
    )

    expect(JSON.parse(packageSource)).toMatchObject({
      name: 'my-course',
      private: true,
      devDependencies: {
        'markdown-it-mathjax3': expect.any(String),
        mermaid: expect.any(String)
      }
    })
    expect(courseSource).toContain("title: '我的课程'")
    expect(courseSource).toContain('allowUnsafeHtml: true')
    expect(themeSource).toContain('createMockGenerator')
    expect(themeSource).toContain('createGentorialRuntime')
    expect(themeSource).toContain('request.conversation')
    expect(themeSource).toContain('allowUnsafeHtml: course.rendering?.allowUnsafeHtml')
    expect(vitepressSource).toContain("import { defineConfig } from 'vitepress'")
    expect(vitepressSource).toContain('math: true')
    expect(vitepressSource).toContain('config: gentorialMarkdown')
  })

  it('refuses to overwrite a non-empty directory', async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), 'gentorial-create-'))
    temporaryDirectories.push(cwd)
    const target = resolve(cwd, 'existing')
    await createGentorialProject({ cwd, targetDir: 'existing' })
    await writeFile(resolve(target, 'user-file.txt'), 'keep me')

    await expect(createGentorialProject({ cwd, targetDir: 'existing' })).rejects.toThrow('非空')
  })
})

describe('validateProjectName', () => {
  it('accepts npm-compatible lowercase names', () => {
    expect(validateProjectName('my-course')).toBeUndefined()
    expect(validateProjectName('MyCourse')).toContain('小写')
  })
})
