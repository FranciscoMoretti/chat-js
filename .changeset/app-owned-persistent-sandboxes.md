---
"@chat-js/sandboxes": minor
"@chat-js/registry": minor
"@chat-js/cli": patch
---

Add an optional persistent filesystem capability to the shared sandbox provider contract and its Vercel registry implementation. Use app-owned EVE resource lifecycle handling when the installed provider supports persistent files. No-provider and execution-only installations explicitly disable EVE filesystem access without resolving sandbox credentials. Cleanup resolves providers only for outstanding owned resources. Requires a fresh world and current database schema. Release the shared package before distributing consumers of its new persistent export.
