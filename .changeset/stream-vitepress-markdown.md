---
"@gentorial/core": patch
"@gentorial/ai": patch
"@gentorial/runtime-vue": patch
"@gentorial/theme-default": patch
---

Preserve generated structure by treating browser streams as standard Markdown. Runtime Markdown is incrementally parsed into safe Vue nodes, retains its source through follow-up conversations and copy actions, and delegates Mermaid fences to the default VitePress theme without exposing author-defined custom containers to AI generation. Add a framework-neutral Web Standards server adapter with JSON lessons, SSE Markdown, authorization, error transport, and cancellation propagation.
