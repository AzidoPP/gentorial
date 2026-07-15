import { serve } from '@hono/node-server'
import { compileCourseDirectory } from '@gentorial/content/node'
import {
  createFileGenerationCache,
  createGentorialServer
} from '@gentorial/server'
import { Hono } from 'hono'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import course from '../course.config.js'
import serverConfig from '../gentorial.server.config.js'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compiled = await compileCourseDirectory({ rootDir, course })
const contentErrors = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
if (contentErrors.length > 0) {
  throw new Error(contentErrors.map((diagnostic) => diagnostic.message).join('\n'))
}

const apiKey = process.env[serverConfig.apiKeyEnv]?.trim()
if (!apiKey) {
  throw new Error(
    `缺少服务端 API Key：请在 .env 中设置 ${serverConfig.apiKeyEnv}`
  )
}

const provider = {
  provider: serverConfig.provider,
  apiKey,
  model: serverConfig.model,
  ...(serverConfig.baseUrl
    ? { baseUrl: serverConfig.baseUrl }
    : {})
}

const generationProfile = [
  serverConfig.provider,
  serverConfig.model,
  serverConfig.baseUrl ?? 'default-base-url',
  serverConfig.profileRevision
].join(':')

const gentorial = createGentorialServer({
  manifests: compiled.manifest,
  provider,
  generationProfile,
  cache: {
    store: createFileGenerationCache(serverConfig.cache),
    onError(error, operation, key) {
      console.error('Gentorial cache error', { error, operation, key })
    }
  }
  // Public production deployments should add authorize(request) here and
  // enforce authentication, rate limits, and quotas at the application edge.
})

const app = new Hono()

app.post('/api/gentorial/generate', (context) => {
  return gentorial.handle(context.req.raw)
})

serve({
  fetch: app.fetch,
  port: serverConfig.port
})

console.log(`Gentorial server listening on http://127.0.0.1:${serverConfig.port}`)
