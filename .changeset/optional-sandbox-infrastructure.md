---
"@chat-js/sandboxes": minor
"@chat-js/registry": minor
"@chat-js/cli": minor
---

Separate optional sandbox infrastructure from code-execution tools. Add a shared provider and lifecycle contract with Vercel and Daytona implementations, selected through `--sandbox-provider`. Install the generic `code-execution` tool instead of the former `vercel-code-execution` or `daytona-code-execution` items. Saved-code execution reuses the generic executor and requires an explicit sandbox selection when none is installed.
