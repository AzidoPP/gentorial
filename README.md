# Gentorial

> Author-defined, learner-shaped tutorials.

[![CI](https://github.com/Minsecrus/gentorial/actions/workflows/ci.yml/badge.svg)](https://github.com/Minsecrus/gentorial/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gentorial/create?label=%40gentorial%2Fcreate)](https://www.npmjs.com/package/@gentorial/create)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.13-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-black.svg)](./LICENSE)

[中文文档](./README.zh-CN.md)

[Technical documentation](https://minsecrus.github.io/gentorial/docs/) · [Roadmap](./PLAN.md) · [Development and testing](https://minsecrus.github.io/gentorial/docs/guide/development)

Gentorial is a VitePress-first framework for tutorials that combine durable, author-written knowledge with explanations generated for each learner. Authors define the facts, scope, and accuracy policies that must remain stable. Learners choose the depth, tone, narrative style, and examples that help them understand those facts.

The original tutorial always remains readable. AI is an optional layer attached to explicit points in the document, not a replacement for the source material.

## Why Gentorial

Conventional documentation gives every learner the same explanation. General-purpose chat can adapt its wording, but often loses the author's intended scope and source of truth. Gentorial keeps those responsibilities separate:

- **Authors define the curriculum.** Concept anchors, source sections, generation prompts, and accuracy policies live in version-controlled files.
- **Learners shape the presentation.** Global preferences affect detail, tone, narrative, and examples without rewriting the underlying claims.
- **Generated content stays in the document.** Explanations appear after the relevant source section and can be regenerated, copied, collapsed, or followed up in place.
- **AI remains optional.** Author-written content remains readable without generation; generated sections use a real managed server or learner-enabled BYOK and fail visibly when neither is configured.

## Features

- Native VitePress configuration—no parallel site-config abstraction.
- `concept` and `generate` Markdown containers with stable IDs and section scope.
- Structured lessons and streamed Markdown rendered through controlled Vue components.
- Vue 3 runtime with cancellation, stale-request protection, regeneration, and follow-up questions.
- Global learner preferences shared across generated sections.
- Browser BYOK adapters for OpenAI, Anthropic, Google, and OpenAI-compatible endpoints, with configurable model and Base URL.
- Framework-neutral server generation adapter with JSON lessons, SSE Markdown, authorization, and cancellation propagation.
- Server-managed provider credentials and shared generation-result caching keyed by course input, learner preferences, and a versioned server generation profile.
- Memory-only handling of learner API keys.
- LaTeX through VitePress MathJax support and lazy Mermaid rendering.
- Interactive scaffolder with npm, pnpm, Yarn, and Bun support.
- Accessible default theme with no `v-html` path for model output.

## Quick start

Requirements:

- Node.js `>=22.13.0`
- One of npm, pnpm, Yarn 2+, or Bun

Create a project with your preferred package manager:

```bash
# npm
npm create @gentorial@latest my-course

# pnpm
pnpm create @gentorial@latest my-course

# Yarn 2+
yarn dlx -p @gentorial/create@latest create-gentorial my-course

# Bun
bunx -p @gentorial/create@latest create-gentorial my-course
```

The scaffolder asks for missing course metadata, detects the invoking package manager, and optionally installs dependencies and initializes Git. Then start the generated site using the command printed by the scaffolder—for example:

```bash
cd my-course
pnpm dev
```

The author-written tutorial opens without an API key. The scaffolder can generate a managed server with a shared cache; browser-only projects require learner BYOK and never fabricate fallback content.

## Generated project

```text
my-course/
├─ content/
│  └─ index.md
├─ docs/
│  └─ .vitepress/
│     ├─ config.ts
│     └─ theme/
│        └─ index.ts
├─ course.config.ts
├─ package.json
├─ README.md
└─ tsconfig.json
```

- `content/` contains the author-written tutorial.
- `docs/.vitepress/config.ts` is a normal VitePress configuration file.
- `docs/.vitepress/theme/index.ts` connects the Gentorial runtime and generator.
- `course.config.ts` defines stable course metadata, generation mode, locale, and accuracy policies.

## Write a tutorial

Authoritative material is ordinary Markdown. Add a `concept` block for a claim that generated explanations must preserve, then attach a `generate` block to the section where adaptation is useful:

```md
## When to use `switch`

::: concept switch-discrete title="Discrete branches"
`switch` selects a branch from the discrete result of an integer expression.
:::

Range checks describe continuous intervals, so an `if` chain is usually clearer.

::: generate switch-range kind=example concepts=switch-discrete
Explain why `switch` is not a direct fit for score ranges, then show a concise alternative.
:::
```

The `generate` block receives the current section as its source scope and explicitly references any required concept anchors. The generated result is inserted after the author-written source rather than replacing it.

Supported generation kinds are `explanation`, `example`, `comparison`, `exercise`, and `feedback`.

## VitePress integration

Gentorial uses VitePress's native Markdown hook:

```ts
// docs/.vitepress/config.ts
import { gentorialMarkdown } from '@gentorial/engine-vitepress'
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'My course',
  srcDir: '../content',
  markdown: {
    math: true,
    config: gentorialMarkdown
  }
})
```

The default theme installs the Vue runtime. In browser-only mode it requires learner-enabled BYOK and reports missing configuration as an error:

```ts
// docs/.vitepress/theme/index.ts
import { createBrowserByokGenerator, type BrowserByokProvider } from '@gentorial/ai'
import { createGentorialRuntime } from '@gentorial/runtime-vue'
import { createGentorialTheme } from '@gentorial/theme-default'
import '@gentorial/theme-default/style.css'
import DefaultTheme from 'vitepress/theme'
import course from '../../../course.config.js'

const runtime = createGentorialRuntime({
  learnerProfile: {
    detail: 'balanced',
    tone: 'conversational',
    narrative: 'direct'
  },
  generate(request, context) {
    if (!context.byok) throw new Error('Configure BYOK before generating')
    const generator = createBrowserByokGenerator({
      ...context.byok,
      provider: context.byok.provider as BrowserByokProvider
    })
    const input = {
      course,
      generate: request.generate,
      concepts: request.concepts
    }
    return generator.stream?.(input, { signal: context.signal })
      ?? generator.generate(input, { signal: context.signal })
  }
})

export default createGentorialTheme({
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(runtime)
  }
})
```

The scaffolded theme contains the complete import list, course configuration, and BYOK provider selection. The shortened example above highlights the runtime boundary.

## AI and security model

Gentorial treats generated output as untrusted data:

1. The engine compiles the section scope, concept anchors, learner profile, and optional conversation.
2. A provider-neutral generator returns a `GeneratedLesson` or a standard Markdown stream.
3. Vue components render controlled blocks directly; model output is not passed to `v-html`.

Gentorial does not judge whether generated content is correct and does not expose a content-validation hook. Accuracy policies and grounding are prompt context owned by the course author, not an enforcement layer in the framework.

Runtime Markdown uses VitePress-compatible CommonMark structure and supports headings, paragraphs, emphasis, links, lists, blockquotes, code fences, and `mermaid` fences. Author-defined VitePress containers are intentionally outside the AI generation contract.

BYOK is learner-controlled and opt-in. Keys entered in the default UI are kept only in the current page's memory and are sent directly to the selected provider. Do not embed an author's production key in a browser bundle; use a server-side or local relay for managed credentials.

Server-managed generation can use `createProviderGenerator` with a framework-neutral generation handler. Configure the handler's shared cache with a versioned namespace covering provider, model, generation parameters, prompt revision, and output schema. The complete course input and learner profile are part of the cache key. Browser BYOK must be selected before the server generator, so personal credentials neither read nor write the server cache.

## Packages

| Package | Responsibility |
| --- | --- |
| [`@gentorial/core`](./packages/core) | Course schemas, stable protocol types, and validation |
| [`@gentorial/content`](./packages/content) | Markdown parsing and course-manifest compilation |
| [`@gentorial/ai`](./packages/ai) | Prompt compilation, structured and streaming generation, BYOK, and server adapters |
| [`@gentorial/server`](./packages/server) | Server-managed credentials, generation endpoints, and shared result caching |
| [`@gentorial/runtime-vue`](./packages/runtime-vue) | Vue runtime state, generation lifecycle, preferences, and rendering |
| [`@gentorial/engine-vitepress`](./packages/engine-vitepress) | VitePress Markdown integration and directive transformation |
| [`@gentorial/theme-default`](./packages/theme-default) | Default VitePress theme integration and styles |
| [`@gentorial/create`](./packages/create) | Interactive project scaffolder and packaged starter template |

## Development

Gentorial is a pnpm workspace.

```bash
git clone https://github.com/Minsecrus/gentorial.git
cd gentorial
pnpm install
pnpm check
```

Useful commands:

```bash
pnpm dev          # run the minimal VitePress example
pnpm dev:website  # run the project website
pnpm build        # build all packages and applications
pnpm typecheck    # type-check every workspace project
pnpm test         # run the test suite
pnpm test:e2e     # run the Playwright Chromium end-to-end suite
```

Before the first E2E run, execute `pnpm exec playwright install chromium`. CI runs the complete check and package dry-run matrix on Windows and Ubuntu with Node.js 22.13 and 24, plus a separate Ubuntu/Chromium browser E2E job.

## Project status

Gentorial is currently in its public `0.x` phase. The authoring, generation, preference, BYOK, managed-server, VitePress, and scaffolding paths are usable, but APIs may still change before `1.0`. Production deployments should review access control, provider transport, privacy requirements, content policies, and generated-output evaluation strategy.

See [PLAN.md](./PLAN.md) for architecture decisions and upcoming work.

## Contributing

Issues and focused pull requests are welcome. For behavioral changes, include tests and run `pnpm check` before submitting; browser-facing changes should also run `pnpm test:e2e`. See [Development and testing](https://minsecrus.github.io/gentorial/docs/guide/development) for the full workflow.

## License

[MIT](./LICENSE) © 2026 Minsecrus
