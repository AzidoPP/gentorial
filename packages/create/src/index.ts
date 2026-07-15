import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type CreateGentorialProjectOptions = {
  targetDir: string
  cwd?: string
  title?: string
  lang?: string
  packageManager?: ProjectPackageManager
  allowUnsafeHtml?: boolean
}

export type ProjectPackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export type CreatedGentorialProject = {
  targetDir: string
  projectName: string
}

function templateDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../template')
}

export function validateProjectName(name: string): string | undefined {
  if (!name) return '项目名不能为空'
  if (name.length > 214) return '项目名不能超过 214 个字符'
  if (name !== name.toLowerCase()) return '项目名必须使用小写字母'
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    return '项目名只能包含小写字母、数字、点、下划线和连字符'
  }
  return undefined
}

async function assertEmptyTarget(targetDir: string): Promise<void> {
  try {
    const targetStat = await stat(targetDir)
    if (!targetStat.isDirectory()) throw new Error(`目标路径不是目录：${targetDir}`)
    const entries = await readdir(targetDir)
    if (entries.length > 0) throw new Error(`目标目录非空，已拒绝覆盖：${targetDir}`)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw error
  }
}

function applyTemplateValues(
  source: string,
  values: {
    projectName: string
    title: string
    lang: string
    installCommand: string
    devCommand: string
    allowUnsafeHtml: string
  }
): string {
  return source
    .replaceAll('__PROJECT_NAME__', values.projectName)
    .replaceAll('__COURSE_TITLE__', values.title)
    .replaceAll('__COURSE_LANG__', values.lang)
    .replaceAll('__INSTALL_COMMAND__', values.installCommand)
    .replaceAll('__DEV_COMMAND__', values.devCommand)
    .replaceAll('__ALLOW_UNSAFE_HTML__', values.allowUnsafeHtml)
}

async function copyTemplateDirectory(
  sourceDir: string,
  targetDir: string,
  values: {
    projectName: string
    title: string
    lang: string
    installCommand: string
    devCommand: string
    allowUnsafeHtml: string
  }
): Promise<void> {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = resolve(sourceDir, entry.name)
    const outputName = entry.name === '_gitignore' ? '.gitignore' : entry.name
    const targetPath = resolve(targetDir, outputName)
    if (entry.isDirectory()) {
      await copyTemplateDirectory(sourcePath, targetPath, values)
      continue
    }
    if (!entry.isFile()) continue

    const source = await readFile(sourcePath, 'utf8')
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, applyTemplateValues(source, values), 'utf8')
  }
}

export async function createGentorialProject(
  options: CreateGentorialProjectOptions
): Promise<CreatedGentorialProject> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const targetDir = resolve(cwd, options.targetDir)
  const projectName = basename(targetDir)
  const validationError = validateProjectName(projectName)
  if (validationError) throw new Error(validationError)

  await assertEmptyTarget(targetDir)
  const packageManager = options.packageManager ?? 'pnpm'
  await copyTemplateDirectory(templateDirectory(), targetDir, {
    projectName,
    title: options.title ?? projectName,
    lang: options.lang ?? 'zh-CN',
    installCommand: packageManager === 'yarn' ? 'yarn' : `${packageManager} install`,
    devCommand: packageManager === 'npm' ? 'npm run dev' : `${packageManager} dev`,
    allowUnsafeHtml: String(options.allowUnsafeHtml === true)
  })
  await mkdir(resolve(targetDir, 'public'), { recursive: true })

  return { targetDir, projectName }
}
