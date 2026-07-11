import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

function workspacePath(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@gentorial/content/node',
        replacement: workspacePath('./packages/content/src/node.ts')
      },
      {
        find: '@gentorial/core',
        replacement: workspacePath('./packages/core/src/index.ts')
      },
      {
        find: '@gentorial/content',
        replacement: workspacePath('./packages/content/src/index.ts')
      },
      {
        find: '@gentorial/ai',
        replacement: workspacePath('./packages/ai/src/index.ts')
      },
      {
        find: '@gentorial/runtime-vue',
        replacement: workspacePath('./packages/runtime-vue/src/index.ts')
      },
      {
        find: '@gentorial/engine-vitepress',
        replacement: workspacePath('./packages/engine-vitepress/src/index.ts')
      },
      {
        find: '@gentorial/theme-default',
        replacement: workspacePath('./packages/theme-default/src/index.ts')
      },
      {
        find: '@gentorial/create',
        replacement: workspacePath('./packages/create/src/index.ts')
      }
    ]
  },
  test: {
    include: ['packages/**/*.test.ts'],
    passWithNoTests: false
  }
})
