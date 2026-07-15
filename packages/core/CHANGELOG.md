# @gentorial/core

## 0.1.1

### Patch Changes

- Add an explicit course option and scaffolding prompt for rendering raw AI-generated HTML.
- 1bb4bd4: Preserve generated structure by treating browser streams as standard Markdown. Runtime Markdown is incrementally parsed into safe Vue nodes, retains its source through follow-up conversations and copy actions, and delegates Mermaid fences to the default VitePress theme without exposing author-defined custom containers to AI generation. Add a framework-neutral Web Standards server adapter with JSON lessons, SSE Markdown, authorization, error transport, and cancellation propagation.

## 0.1.0

### Minor Changes

- Publish the first usable Gentorial framework release, including the interactive scaffolder, VitePress integration, learner preferences, BYOK generation pipeline, and default tutorial UI.
