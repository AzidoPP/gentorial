#!/usr/bin/env node
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
  spinner,
  text
} from '@clack/prompts'
import { spawn } from 'node:child_process'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  createGentorialProject,
  validateProjectName,
  type ProjectPackageManager
} from './index.js'

export type PackageManager = ProjectPackageManager

type CliOptions = {
  targetDir?: string
  title?: string
  lang?: string
  packageManager?: PackageManager
  allowUnsafeHtml?: boolean
  install?: boolean
  git?: boolean
  yes: boolean
  help: boolean
}

class CliCancelledError extends Error {}

function help(): string {
  return [
    'Usage: npm create @gentorial@latest [project-name] [options]',
    '',
    'Options:',
    '  --title <title>                 Course title',
    '  --lang <locale>                 Default locale (default: zh-CN)',
    '  --package-manager <name>        pnpm, npm, yarn, or bun',
    '  --allow-unsafe-html             Render raw HTML in AI-generated content',
    '  --no-unsafe-html                Keep raw HTML inert (default)',
    '  --install / --no-install        Install dependencies or skip installation',
    '  --git / --no-git                Initialize Git or skip it',
    '  -y, --yes                       Accept defaults without prompting',
    '  -h, --help                      Show this help'
  ].join('\n')
}

function optionValue(arguments_: string[], index: number, name: string): string {
  const value = arguments_[index + 1]
  if (!value || value.startsWith('-')) throw new Error(`${name} 缺少值。`)
  return value
}

function parseArguments(arguments_: string[]): CliOptions {
  const options: CliOptions = { yes: false, help: false }

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!
    if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--yes' || argument === '-y') options.yes = true
    else if (argument === '--install') options.install = true
    else if (argument === '--no-install') options.install = false
    else if (argument === '--allow-unsafe-html') options.allowUnsafeHtml = true
    else if (argument === '--no-unsafe-html') options.allowUnsafeHtml = false
    else if (argument === '--git') options.git = true
    else if (argument === '--no-git') options.git = false
    else if (argument === '--title') options.title = optionValue(arguments_, index++, argument)
    else if (argument === '--lang') options.lang = optionValue(arguments_, index++, argument)
    else if (argument === '--package-manager') {
      const value = optionValue(arguments_, index++, argument)
      if (!isPackageManager(value)) throw new Error(`不支持的包管理器：${value}`)
      options.packageManager = value
    } else if (argument.startsWith('-')) {
      throw new Error(`未知选项：${argument}\n\n${help()}`)
    } else if (!options.targetDir) {
      options.targetDir = argument
    } else {
      throw new Error(`只能指定一个项目目录：${argument}`)
    }
  }

  return options
}

function isPackageManager(value: string): value is PackageManager {
  return value === 'pnpm' || value === 'npm' || value === 'yarn' || value === 'bun'
}

export function detectPackageManager(userAgent = process.env.npm_config_user_agent): PackageManager | undefined {
  if (!userAgent) return undefined
  const name = /^([^/\s]+)/u.exec(userAgent.trim())?.[1]
  return name && isPackageManager(name) ? name : undefined
}

export function packageManagerInstallCommand(packageManager: PackageManager): [string, string[]] {
  return packageManager === 'yarn'
    ? ['yarn', []]
    : [packageManager, ['install']]
}

function packageManagerDevCommand(packageManager: PackageManager): string {
  return packageManager === 'npm' ? 'npm run dev' : `${packageManager} dev`
}

function executable(command: string): string {
  return process.platform === 'win32' && ['npm', 'pnpm', 'yarn'].includes(command)
    ? `${command}.cmd`
    : command
}

function runCommand(command: string, arguments_: string[], cwd: string, quiet = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable(command), arguments_, {
      cwd,
      stdio: quiet ? 'ignore' : 'inherit'
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${arguments_.join(' ')} 执行失败（退出码 ${code ?? 'unknown'}）`))
    })
  })
}

function answer<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('已取消创建。')
    throw new CliCancelledError()
  }
  return value
}

export async function run(arguments_: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(arguments_)
  if (options.help) {
    console.log(help())
    return
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !options.yes)
  if (interactive) intro('create-gentorial')

  let targetDir = options.targetDir
  if (!targetDir && interactive) {
    targetDir = answer(await text({
      message: 'Project name',
      initialValue: 'my-course',
      validate: (value) => validateProjectName(basename((value ?? '').trim()))
    })).trim()
  }
  if (!targetDir) throw new Error(`缺少项目名。\n\n${help()}`)

  const projectName = basename(targetDir)
  const title = options.title ?? (interactive
    ? answer(await text({
        message: 'Course title',
        initialValue: projectName,
        validate: (value) => value?.trim() ? undefined : '课程标题不能为空'
      })).trim()
    : projectName)

  const lang = options.lang ?? (interactive
    ? answer(await select({
        message: 'Language',
        initialValue: 'zh-CN',
        options: [
          { value: 'zh-CN', label: '简体中文' },
          { value: 'en', label: 'English' }
        ]
      }))
    : 'zh-CN')

  const allowUnsafeHtml = options.allowUnsafeHtml ?? (interactive
    ? answer(await confirm({
        message: lang === 'zh-CN'
          ? '是否渲染 AI 生成内容中的原始 HTML？开启后，它将获得当前站点的同源权限。'
          : 'Render raw HTML in AI-generated content? It will have this site\'s origin privileges.',
        initialValue: false
      }))
    : false)

  const detectedPackageManager = options.packageManager ?? detectPackageManager()
  const packageManager = detectedPackageManager ?? (interactive
    ? answer(await select<PackageManager>({
        message: 'Package manager',
        initialValue: 'pnpm',
        options: [
          { value: 'pnpm', label: 'pnpm' },
          { value: 'npm', label: 'npm' },
          { value: 'yarn', label: 'Yarn' },
          { value: 'bun', label: 'Bun' }
        ]
      }))
    : 'pnpm')

  const shouldInstall = options.install ?? (interactive
    ? answer(await confirm({ message: `Install dependencies with ${packageManager}?`, initialValue: true }))
    : options.yes)
  const shouldInitializeGit = options.git ?? (interactive
    ? answer(await confirm({ message: 'Initialize Git?', initialValue: true }))
    : options.yes)

  const result = await createGentorialProject({
    targetDir,
    title,
    lang,
    packageManager,
    allowUnsafeHtml
  })

  if (shouldInstall) {
    const [command, commandArguments] = packageManagerInstallCommand(packageManager)
    const installation = interactive ? spinner() : undefined
    installation?.start(`Installing dependencies with ${packageManager}`)
    try {
      await runCommand(command, commandArguments, result.targetDir, interactive)
      installation?.stop('Dependencies installed')
    } catch (error) {
      installation?.stop('Dependency installation failed')
      throw error
    }
  }

  if (shouldInitializeGit) {
    try {
      await runCommand('git', ['init'], result.targetDir, interactive)
      if (interactive) log.success('Git initialized')
    } catch {
      if (interactive) log.warn('Git is unavailable; skipped repository initialization')
    }
  }

  const nextSteps = [
    `cd ${targetDir}`,
    ...(!shouldInstall ? [`${packageManagerInstallCommand(packageManager)[0]}${packageManager === 'yarn' ? '' : ' install'}`] : []),
    packageManagerDevCommand(packageManager)
  ]

  if (interactive) {
    outro(`Created ${result.projectName}\n\n${nextSteps.map((step) => `  ${step}`).join('\n')}`)
  } else {
    console.log(`已创建 ${result.projectName}`)
    console.log(`\n${nextSteps.map((step) => `  ${step}`).join('\n')}\n`)
  }
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  run().catch((error: unknown) => {
    if (error instanceof CliCancelledError) return
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
