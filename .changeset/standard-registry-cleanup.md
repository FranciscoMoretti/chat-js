---
"@chat-js/registry": major
"@chat-js/cli": major
---

Build standard registry JSON from tested TypeScript sources using shadcn. Use
shadcn for gateway/tool installation and generate typed registrations from local
tool descriptors. Add `chat-js sync` and separate custom registration modules.

Registry v1 publishes `dist/r/`; historical v0 npm artifacts keep their legacy
format. Publish registry v1 and gateway contracts before promoting the CLI.
Remove `--registry`, `--no-install`, `--package-manager`, and `paths.tools` in
favor of standard namespaces, immediate installation, package-manager detection,
and explicit registry targets. Known legacy built-in registrations migrate on sync.
