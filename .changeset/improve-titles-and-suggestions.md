---
"@chat-js/cli": patch
---

- Improve AI title generation prompt for cleaner, more concise titles
- Switch title and followup suggestion workflows to `google/gemini-2.5-flash-lite`
- Refactor followup suggestions to use recent messages for better context
- Fix streamdown source path in globals.css for wildcard imports
- Rename internal references from `chat.js` to `chat-js` for consistency
- Simplify template sync process
