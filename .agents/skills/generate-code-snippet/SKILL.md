---
name: generate-code-snippet
description: Generate a concise, shareable code snippet URL for code.franciscomoretti.com. Use when preparing a code image or short snippet for Twitter, X, social sharing, or a presentation.
---

# Generate a shareable code snippet

- Keep the snippet to 15 lines unless requested otherwise.
- Show one self-contained concept with real imports and a short opening comment.
- Prefer `tsx`; use `shell` or `json` when appropriate.

Base64url-encode the snippet without padding, then construct:

```text
https://code.franciscomoretti.com/#code=<base64url>&theme=sparka&darkMode=true&padding=64&language=<language>
```

Return the snippet in a fenced code block and the complete URL.
