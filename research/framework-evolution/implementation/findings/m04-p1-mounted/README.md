# Mounted P1 integration proof

This test host uses production `ConversationView`, `MessagesPane`, `MultimodalInput`, draft/model providers and the workspace document panel. Two views bind to one real `ApplicationThread` with a controlled streaming transport. Upload responses are intercepted. The regular authenticated Next layout and Query providers remain in use.

1. Install frozen dependencies and build `packages/thread` with Bun.
2. Run `bun dev:info --json` and start `bun dev` with the normal development environment.
3. Make an ignored `node_modules` symlink in this folder to `../../../../../apps/chat/node_modules` if absent.
4. Run `bun apps/chat/node_modules/typescript/bin/tsc -p research/framework-evolution/implementation/findings/m04-p1-mounted/tsconfig.json`.
5. Set `M04_APP_URL` to the discovered URL and run `bun research/framework-evolution/implementation/findings/m04-p1-mounted/proof.ts`.

Requires installed Chrome. The script refuses to overwrite an existing `apps/chat/app/(chat)/m04-p1-proof` directory, copies the host there, opens a separate browser, and removes the temporary route in `finally`. Do not run two copies in the same checkout. Development-only React Scan and TanStack diagnostic overlays are suppressed in this browser because their launchers cover the document toolbar.

Checks independent paths/drafts/models, production composer sends, editing without clearing the main draft, stable provisional draft restoration after reload, stale uploads after selection away/back, an old upload not clearing a newer upload's pending state, workspace document visibility and command ancestry after branch navigation, and view selection/draft restoration after remount. Any page error fails the proof.

The API transport is controlled: no real model execution, blob upload, document persistence or Eve claim. The fixture does not implement application workflows; it binds and observes the production components. Live model smoke is separately recorded in `../m04-p1.md`.
