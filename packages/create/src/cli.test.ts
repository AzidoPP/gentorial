import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  detectPackageManager,
  packageManagerInstallCommand,
  run
} from './cli.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('create-gentorial CLI', () => {
  it.each([
    ['pnpm/11.1.2 npm/? node/v24', 'pnpm'],
    ['npm/11.4.2 node/v24 win32 x64', 'npm'],
    ['yarn/4.9.1 npm/? node/v24', 'yarn'],
    ['bun/1.2.18 npm/? node/v24', 'bun']
  ])('detects the invoking package manager from %s', (userAgent, expected) => {
    expect(detectPackageManager(userAgent)).toBe(expected)
  })

  it('maps package managers to their native install commands', () => {
    expect(packageManagerInstallCommand('pnpm')).toEqual(['pnpm', ['install']])
    expect(packageManagerInstallCommand('npm')).toEqual(['npm', ['install']])
    expect(packageManagerInstallCommand('yarn')).toEqual(['yarn', []])
    expect(packageManagerInstallCommand('bun')).toEqual(['bun', ['install']])
  })

  it('supports deterministic non-interactive creation without install or Git side effects', async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), 'gentorial-cli-'))
    temporaryDirectories.push(cwd)
    const target = resolve(cwd, 'cli-course')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await run([
      target,
      '--title', 'CLI 课程',
      '--lang', 'zh-CN',
      '--package-manager', 'npm',
      '--allow-unsafe-html',
      '--no-install',
      '--no-git'
    ])

    const packageSource = JSON.parse(await readFile(resolve(target, 'package.json'), 'utf8')) as {
      name: string
    }
    const readme = await readFile(resolve(target, 'README.md'), 'utf8')
    const courseSource = await readFile(resolve(target, 'course.config.ts'), 'utf8')
    expect(packageSource.name).toBe('cli-course')
    expect(readme).toContain('npm install')
    expect(readme).toContain('npm run dev')
    expect(courseSource).toContain('allowUnsafeHtml: true')
  })
})
