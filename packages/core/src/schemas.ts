import { z } from 'zod'
import type { GentorialPlugin } from './plugin.js'

const nonBlankString = z.string().min(1).refine((value) => value.trim().length > 0, {
  message: 'Must not be blank'
})

const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i, 'Invalid stable identifier')

export const sourceLocationSchema = z
  .object({
    file: nonBlankString,
    line: z.number().int().positive(),
    column: z.number().int().positive().optional()
  })
  .strict()

export const validationDiagnosticSchema = z
  .object({
    severity: z.enum(['error', 'warning', 'info']),
    code: nonBlankString,
    message: nonBlankString,
    source: sourceLocationSchema.optional(),
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])).optional()
  })
  .strict()

const pluginSchema = z.custom<GentorialPlugin>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'name') === 'string' &&
    typeof Reflect.get(value, 'version') === 'string',
  'Invalid Gentorial plugin'
)

export const courseDefinitionSchema = z
  .object({
    schemaVersion: z.literal('1'),
    id: idSchema,
    title: nonBlankString,
    description: nonBlankString.optional(),
    lang: nonBlankString,
    contentDir: nonBlankString,
    generation: z
      .object({
        mode: z.enum(['snapshot', 'on-demand', 'hybrid']),
        defaultLocale: nonBlankString
      })
      .strict(),
    accuracy: z
      .object({
        policies: z.array(nonBlankString),
        standards: z.array(nonBlankString).optional()
      })
      .strict(),
    plugins: z.array(pluginSchema).optional()
  })
  .strict()

export const conceptSpecSchema = z
  .object({
    id: idSchema,
    title: nonBlankString.optional(),
    statement: nonBlankString,
    source: sourceLocationSchema
  })
  .strict()

export const generateSpecSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['explanation', 'example', 'comparison', 'exercise', 'feedback']),
    prompt: nonBlankString,
    concepts: z.array(idSchema).min(1),
    source: sourceLocationSchema
  })
  .strict()

export const paragraphBlockSchema = z
  .object({
    type: z.literal('paragraph'),
    text: nonBlankString
  })
  .strict()

export const headingBlockSchema = z
  .object({
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: nonBlankString
  })
  .strict()

export const listBlockSchema = z
  .object({
    type: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(nonBlankString).min(1)
  })
  .strict()

export const codeBlockSchema = z
  .object({
    type: z.literal('code'),
    code: nonBlankString,
    language: nonBlankString.optional(),
    caption: nonBlankString.optional()
  })
  .strict()

export const calloutBlockSchema = z
  .object({
    type: z.literal('callout'),
    tone: z.enum(['info', 'tip', 'warning', 'danger']),
    title: nonBlankString.optional(),
    text: nonBlankString
  })
  .strict()

const comparisonSideSchema = z
  .object({
    title: nonBlankString,
    items: z.array(nonBlankString).min(1)
  })
  .strict()

export const comparisonBlockSchema = z
  .object({
    type: z.literal('comparison'),
    left: comparisonSideSchema,
    right: comparisonSideSchema
  })
  .strict()

export const lessonBlockSchema = z.discriminatedUnion('type', [
  paragraphBlockSchema,
  headingBlockSchema,
  listBlockSchema,
  codeBlockSchema,
  calloutBlockSchema,
  comparisonBlockSchema
])

export const generatedLessonSchema = z
  .object({
    schemaVersion: z.literal('1'),
    title: nonBlankString.optional(),
    blocks: z.array(lessonBlockSchema).min(1),
    grounding: z
      .object({
        conceptIds: z.array(idSchema),
        notes: z.array(nonBlankString).optional()
      })
      .strict()
  })
  .strict()

const manifestCourseSchema = courseDefinitionSchema
  .omit({ plugins: true })
  .extend({
    plugins: z
      .array(
        z
          .object({
            name: nonBlankString,
            version: nonBlankString
          })
          .strict()
      )
      .optional()
  })
  .strict()

export const courseManifestSchema = z
  .object({
    schemaVersion: z.literal('1'),
    course: manifestCourseSchema,
    concepts: z.array(conceptSpecSchema),
    generates: z.array(generateSpecSchema),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/)
  })
  .strict()
