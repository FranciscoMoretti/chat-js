# Chat page visual tests

This private workspace verifies the reference app in `apps/chat`. Its tests, configuration, and capture output are maintainer tooling, outside the CLI's scaffold source. Generated application behavior is covered separately by the CLI scaffold tests.

- Render the real route files and layouts through `pages/render.tsx`. Add a capture in `pages/*.browser.tsx` whenever an app page or visible state changes.
- Capture desktop and mobile in light and dark after queries and layout settle. Use `viewports: ["desktop"]` only when the mobile state looks the same as an existing capture.
- `pages/setup.tsx` reuses the registry's fonts, CSS, and motion freeze. It doubles framework modules, authentication, server reads, tRPC, and EVE transcripts. Put state data in `pages/fixtures.ts`; missing procedure fixtures fail the test.
- Assert the content that distinguishes the state before capture. A heading also present in a loading skeleton is insufficient.
- From the repository root, run `bun test:visual:chat`. Upload using `bun uiverify:upload:chat` with the Chat project's `UIVERIFY_API_KEY`. CI uses `UIVERIFY_CHAT_API_KEY`; captures stay in this package's `uiverify-archive/`.
- `pages/coverage.test.ts` checks that every renderable route file is exercised. It runs as this package's unit test; state coverage still requires review.
