#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { createGentorialProject } from './index.js'

function help(): string {
  return [
    'Usage: npm create @gentorial@latest <project-name> [options]',
    '',
    'Options:',
    '  --title <title>  Course title',
    '  --lang <locale>  Default locale (default: zh-CN)',
    '  --no-install     Accepted for CI; dependencies are not installed yet',
    '  -h, --help       Show this help'
  ].join('\n')
}

function optionValue(arguments_: string[], name: string): string | undefined {
  const index = arguments_.indexOf(name)
  return index >= 0 ? arguments_[index + 1] : undefined
}

export async function run(arguments_: string[] = process.argv.slice(2)): Promise<void> {
  if (arguments_.includes('--help') || arguments_.includes('-h')) {
    console.log(help())
    return
  }

  const targetDir = arguments_[0]
  if (!targetDir || targetDir.startsWith('-')) throw new Error(`缺少项目名。\n\n${help()}`)

  const title = optionValue(arguments_, '--title')
  const lang = optionValue(arguments_, '--lang')

  const result = await createGentorialProject({
    targetDir,
    ...(title ? { title } : {}),
    ...(lang ? { lang } : {})
  })

  console.log(`已创建 ${result.projectName}`)
  console.log(`\n  cd ${targetDir}\n  pnpm install\n  pnpm dev\n`)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
