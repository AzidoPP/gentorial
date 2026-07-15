import {
  createGentorialGenerationHandler,
  createMemoryGenerationCache,
  createProviderGenerator,
  type Generator,
  type GentorialGenerationAuthorization,
  type GentorialGenerationCacheOperation,
  type GentorialGenerationCacheOptions,
  type GentorialGenerationCacheStore,
  type GentorialGenerationLimits,
  type GentorialMemoryGenerationCacheOptions,
  type ProviderCredentials,
  type ProviderGeneratorOptions
} from '@gentorial/ai'
import type { CourseManifest, GeneratedLesson } from '@gentorial/core'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

type GentorialServerSource =
  | { provider: ProviderCredentials; generator?: never; providerOptions?: ProviderGeneratorOptions }
  | { generator: Generator; provider?: never; providerOptions?: never }

export type GentorialServerCacheOptions = {
  store?: GentorialGenerationCacheStore
  memory?: GentorialMemoryGenerationCacheOptions
  key?: GentorialGenerationCacheOptions['key']
  onError?: (
    error: unknown,
    operation: GentorialGenerationCacheOperation,
    key: string
  ) => void
}

export type GentorialServerOptions = GentorialServerSource & {
  /** Server-owned course manifests used to rebuild every managed generation input. */
  manifests: CourseManifest | readonly CourseManifest[]
  /**
   * Versioned identity of provider, model, generation parameters, prompt, and
   * output protocol. Never include the raw API key.
   */
  generationProfile: string
  cache?: GentorialServerCacheOptions | false
  authorize?: GentorialGenerationAuthorization
  headers?: HeadersInit
  limits?: GentorialGenerationLimits | false
}

export type GentorialServer = {
  generator: Generator
  cache: GentorialGenerationCacheStore | undefined
  handle(request: Request): Promise<Response>
}

export type GentorialFileGenerationCacheOptions = {
  directory: string
  ttlMs?: number
}

type FileCacheEnvelope = {
  schemaVersion: '1'
  expiresAt: number
  lesson: GeneratedLesson
}

function nonBlank(value: string, name: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${name} must not be blank`)
  return normalized
}

function cacheFilename(key: string): string {
  return `${createHash('sha256').update(key).digest('hex')}.json`
}

function isFileCacheEnvelope(value: unknown): value is FileCacheEnvelope {
  return Boolean(
    value
    && typeof value === 'object'
    && Reflect.get(value, 'schemaVersion') === '1'
    && typeof Reflect.get(value, 'expiresAt') === 'number'
    && Reflect.get(value, 'lesson')
    && typeof Reflect.get(value, 'lesson') === 'object'
  )
}

/**
 * Creates a process-independent file cache for a single Node.js server.
 * Distributed deployments should provide a Redis, KV, or database store.
 */
export function createFileGenerationCache(
  options: GentorialFileGenerationCacheOptions
): GentorialGenerationCacheStore {
  const directory = resolve(nonBlank(options.directory, 'cache directory'))
  const ttlMs = Math.max(1, Math.floor(options.ttlMs ?? 7 * 24 * 60 * 60 * 1_000))

  return {
    async get(key) {
      const path = join(directory, cacheFilename(key))
      try {
        const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
        if (!isFileCacheEnvelope(parsed)) {
          await rm(path, { force: true })
          return undefined
        }
        if (parsed.expiresAt <= Date.now()) {
          await rm(path, { force: true })
          return undefined
        }
        return parsed.lesson
      } catch (error) {
        if (error && typeof error === 'object' && Reflect.get(error, 'code') === 'ENOENT') {
          return undefined
        }
        throw error
      }
    },
    async set(key, lesson) {
      await mkdir(directory, { recursive: true })
      const path = join(directory, cacheFilename(key))
      const temporary = `${path}.${randomUUID()}.tmp`
      const envelope: FileCacheEnvelope = {
        schemaVersion: '1',
        expiresAt: Date.now() + ttlMs,
        lesson
      }
      await writeFile(temporary, JSON.stringify(envelope), 'utf8')
      try {
        await rename(temporary, path)
      } catch (error) {
        await rm(temporary, { force: true })
        throw error
      }
    }
  }
}

/** Creates a complete framework-neutral Gentorial generation service. */
export function createGentorialServer(options: GentorialServerOptions): GentorialServer {
  const generationProfile = nonBlank(options.generationProfile, 'generationProfile')
  const generator = options.generator
    ?? createProviderGenerator(options.provider, options.providerOptions)
  const cache = options.cache === false
    ? undefined
    : options.cache?.store ?? createMemoryGenerationCache(options.cache?.memory)
  const handle = createGentorialGenerationHandler({
    generator,
    manifests: options.manifests,
    ...(options.authorize ? { authorize: options.authorize } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.limits !== undefined ? { limits: options.limits } : {}),
    ...(cache
      ? {
          cache: {
            namespace: generationProfile,
            store: cache,
            ...(options.cache && options.cache.key ? { key: options.cache.key } : {}),
            ...(options.cache && options.cache.onError ? { onError: options.cache.onError } : {})
          }
        }
      : {})
  })

  return { generator, cache, handle }
}

export {
  createGentorialGenerationDefinitionHash,
  createGentorialGenerationCacheKey,
  createGentorialServerGenerator,
  createMemoryGenerationCache
} from '@gentorial/ai'
export type {
  GenerationInput,
  Generator,
  GentorialGenerationAuthorization,
  GentorialGenerationCacheOperation,
  GentorialGenerationCacheOptions,
  GentorialGenerationCacheStore,
  GentorialGenerationLimits,
  GentorialMemoryGenerationCacheOptions,
  Provider,
  ProviderCredentials,
  ProviderGeneratorOptions
} from '@gentorial/ai'
