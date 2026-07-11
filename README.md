# Gentorial

> Generate a tutorial for every learner—without giving up the teaching specification.

[简体中文](./README.zh-CN.md) · English

Gentorial is an open-source framework for generative tutorials. Authors write the concepts, boundaries, and accuracy requirements that must remain stable, then use short local prompts to request explanations, examples, comparisons, exercises, or feedback. Gentorial compiles those inputs, calls a replaceable generator, validates the structured result, and renders only registered lesson blocks.

The project is under active development toward `0.1.0`. No npm package has been published yet.

## Why Gentorial?

- **Concepts stay explicit.** Author-written concept anchors are rendered into static HTML and cannot be replaced by generated prose.
- **Generation stays constrained.** Model output must conform to the `GeneratedLesson` protocol; arbitrary HTML, scripts, and Vue templates are rejected.
- **Failures stay readable.** Static fallback content remains available when AI is disabled, offline, cancelled, or invalid.
- **Providers and engines stay replaceable.** Course protocols do not depend on a model SDK, Vue, VitePress, Nuxt, or the file system.
- **BYOK stays server-side by default.** Author keys belong in build processes, local relays, or controlled server environments—not browser bundles.

## Authoring model

```md
::: concept switch-discrete title="Where switch applies"
`switch` selects a branch from the discrete result of an integer expression after integer promotion.
:::

::: generate switch-range kind=example concepts=switch-discrete
Show why switch is not a direct fit for continuous ranges such as score intervals.
:::

::: generate switch-table kind=example concepts=switch-discrete
Show how repeated branches can sometimes be replaced with table-driven code.
:::
```

The concept body is part of the course specification and the static page. The generate body is a local teaching intent; course-level policies, referenced concepts, learner preferences, and the output schema are added by the framework.

## Packages

| Package | Responsibility |
| --- | --- |
| `@gentorial/core` | Course definitions, schemas, controlled lesson blocks, diagnostics, and plugin contracts |
| `@gentorial/content` | Pure Markdown directive parsing and Node.js course-directory compilation |
| `@gentorial/ai` | Prompt compilation, provider/transport contracts, validation, and deterministic mocks |
| `@gentorial/runtime-vue` | Request lifecycle and safe Vue rendering for registered lesson blocks |
| `@gentorial/engine-vitepress` | VitePress configuration and Markdown container integration |
| `@gentorial/theme-default` | Default component registration and accessible baseline styles |
| `@gentorial/create` | Packaged project template and the future `npm create @gentorial` entry point |

`examples/minimal` is the current vertical fixture. Its VitePress output contains the author-written `switch` concept anchor, static fallback content, and two independently generated mock sections.

## Development

Requirements:

- Node.js `>=20.19.0`
- pnpm `11.1.2`

```bash
pnpm install
pnpm check
pnpm dev
```

`pnpm check` builds every package and the minimal VitePress site, performs strict TypeScript checks, and runs the protocol and integration tests.

To exercise the local scaffolder:

```bash
pnpm build
node packages/create/dist/cli.js my-course --no-install
```

The generated project intentionally starts without an AI key. The public workflow targeted for `0.1.0` is:

```bash
npm create @gentorial@latest my-course
cd my-course
npm run dev
```

## Project status

The repository currently includes the package foundations, deterministic mock pipeline, VitePress vertical example, tests, Changesets configuration, and Windows/Ubuntu CI. The next milestones are full manifest consumption in the VitePress build, page-level invalid-result fallback tests, one real build-time provider adapter, audited snapshots, and the complete scaffolder flow.

See [PLAN.md](./PLAN.md) for architecture decisions, security constraints, milestones, and the `0.1.0` completion definition.

## License

Gentorial is available under the [MIT License](./LICENSE).
