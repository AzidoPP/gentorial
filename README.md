# Gentorial

> Generate a tutorial for every learner—without giving up the teaching specification.

[简体中文](./README.zh-CN.md) · English

Gentorial is an open-source framework for generative tutorials. Authors write the concepts, boundaries, and accuracy requirements that must remain stable, then use short local prompts to request explanations, examples, comparisons, exercises, or feedback. Gentorial compiles those inputs, calls a replaceable generator, validates the structured result, and renders only registered lesson blocks.

The project is under active development toward `0.1.0`. Every workspace package is currently versioned `0.0.0`, and no npm package has been published yet.

## Why Gentorial?

- **Concepts stay explicit.** Author-written concept anchors are rendered into static HTML and cannot be replaced by generated prose.
- **Generation stays constrained.** Model output must conform to the `GeneratedLesson` protocol; arbitrary HTML, scripts, and Vue templates are rejected.
- **Failures preserve the tutorial.** The default UI leaves a failed output empty and keeps the author-written lesson untouched; custom integrations may opt into fallback blocks.
- **Providers and engines stay replaceable.** Course protocols do not depend on a model SDK, Vue, VitePress, Nuxt, or the file system.
- **BYOK stays server-side by default.** Author keys belong in build processes, local relays, or controlled server environments—not browser bundles.

## Authoring model

```md
::: concept switch-discrete title="Where switch applies"
`switch` selects a branch from the discrete result of an integer expression after integer promotion.
:::

## Continuous ranges

Score intervals describe ranges rather than individual discrete values.

::: generate switch-range kind=example concepts=switch-discrete
Show why switch is not a direct fit for continuous ranges such as score intervals.
:::

## Similar branches

Repeated branches can obscure a data-driven structure when only their values differ.

::: generate switch-table kind=example concepts=switch-discrete
Show how repeated branches can sometimes be replaced with table-driven code.
:::
```

The concept body is part of the course specification and the static page. The generate body is a local teaching intent; course-level policies, referenced concepts, learner preferences, and the output schema are added by the framework.

### Generate from an authored section

An ordinary section can provide the content boundary even when it does not need a separate concept anchor:

```md
## History of C

1. ALGOL, CPL, and BCPL
2. B
3. C

::: generate c-history kind=explanation
Explain how this language lineage led to C and which key design influences each stage left behind.
:::
```

The compiler treats the author-written list as the section scope and attaches a low-interference generate trigger to the nearest heading. Its visual contract is a bare `✦` icon: no visible “Generate” label, background, or border; hover and keyboard focus change only its color or opacity. The accessible name is localized (`按需展开` in Chinese and “Expand on demand” in English).

The generated lesson appears directly in the document flow after the original text. Only its validated `GeneratedLesson` blocks are visible: the result itself has no repeated `✦`, “personalized explanation” label, marker, background, border, or visible loading/error text. Invisible ARIA state may remain for assistive technology. A first failed request leaves this location empty and the author text unchanged; fallback blocks remain available to custom integrations but are not part of the default unobtrusive UI. Regenerating replaces the main result instead of appending another copy. Learners choose `detail`, `tone`, and `narrative` globally, so those preferences shape the explanation without widening its author-defined scope.

### Follow-up questions

Follow-up capability remains bound to each generated lesson. Once a lesson is available, its end contains a persistent single-line input with the placeholder “Ask a follow-up…” and a Send button; learners do not have to discover an interaction by clicking tutorial text. Enter or Send submits, while Escape cancels an active request and clears the draft. The learner’s question and labels such as “You” or “Response” are never rendered. Each validated assistant `GeneratedLesson` is inserted above the composer as the next ordinary structured content block.

Every follow-up still inherits the same `SectionScope`, referenced concept anchors, course policies, learner profile, current explanation, and prior completed turns as internal context. It must ground itself in the same required `sourceIds` and `conceptIds`. Cancelled, failed, or superseded requests add no visible partial turn, and a successful main regeneration clears the conversation attached to the result it replaced.

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

`examples/minimal` is the current vertical fixture. Its VitePress output contains the author-written `switch` concept anchor, a section-scoped “History of C” example, heading-attached generation triggers, document-native deterministic mock results, and a persistent follow-up composer with a send action.

`apps/website` is the static Gentorial landing site. It uses React, Tailwind CSS, and Lucide with a monochrome visual system.

## Development

Requirements:

- Node.js `>=20.19.0`
- pnpm `11.1.2`

```bash
pnpm install
pnpm check
pnpm dev
pnpm dev:website
```

`pnpm check` builds every package, the minimal VitePress site, and the static landing site; it also performs strict TypeScript checks and runs the protocol and integration tests.

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

The repository currently includes the package foundations, deterministic mock pipeline, document-native explanation output, transient per-result follow-up input, global presentation preferences, a VitePress vertical example, tests, Changesets configuration, and Windows/Ubuntu CI. It still uses version `0.0.0` packages and deterministic mocks rather than a real model. The next milestones include full manifest consumption in the VitePress build, page-level silent-failure and custom-fallback tests, one real build-time provider adapter, audited snapshots, and the complete scaffolder flow.

See [PLAN.md](./PLAN.md) for architecture decisions, security constraints, milestones, and the `0.1.0` completion definition.

## License

Gentorial is available under the [MIT License](./LICENSE).
