# @gentorial/theme-default

## 0.1.1

### Patch Changes

- Use Lucide for standard action icons and align inline generation controls on one compact visual track.
- Align the reusable VitePress preferences flow with the Gentorial website: use the same three-column option cards, BYOK field order, Geist typography, translucent blurred overlay, control geometry, selected states, navigation, and responsive layout.
- Add an explicit course option and scaffolding prompt for rendering raw AI-generated HTML.
- Keep author-authored concept content visually plain and reserve the accent edge for expanded AI results.
- Render generated code fences with VitePress-compatible Shiki highlighting, copy controls, language labels, and optional line numbers.
- Render generation failures inline with an accessible message and a red result edge.
- 1bb4bd4: Preserve generated structure by treating browser streams as standard Markdown. Runtime Markdown is incrementally parsed into safe Vue nodes, retains its source through follow-up conversations and copy actions, and delegates Mermaid fences to the default VitePress theme without exposing author-defined custom containers to AI generation. Add a framework-neutral Web Standards server adapter with JSON lessons, SSE Markdown, authorization, error transport, and cancellation propagation.
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [1bb4bd4]
  - @gentorial/runtime-vue@0.2.0

## 0.1.0

### Minor Changes

- Publish the first usable Gentorial framework release, including the interactive scaffolder, VitePress integration, learner preferences, BYOK generation pipeline, and default tutorial UI.

### Patch Changes

- Updated dependencies
  - @gentorial/runtime-vue@0.1.0
