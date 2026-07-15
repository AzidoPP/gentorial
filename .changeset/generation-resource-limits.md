---
"@gentorial/ai": minor
"@gentorial/server": minor
"@gentorial/runtime-vue": minor
---

Add independent context and generation resource limits. The runtime rejects over-budget active paths without trimming conversation history, managed handlers enforce request/input/follow-up/output limits before caching, streams stop on oversized output, and provider generators accept a portable maximum output token setting.
