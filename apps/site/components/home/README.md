# ChatJS homepage

The `/` route presents the ChatJS building blocks and source ownership. Layout and content are server-rendered; block dialogs, command copying, and source playback are small client components. All styles are scoped to `.home-page` so Create and Threads remain independent.

The canonical identity and artwork live in `packages/brand` (see its README). Run `bun brand:generate` after changing brand sources. The homepage logo imports the shared mark; both animation frames use its generated square renderer. The 21 SVGs in `public/home/blocks` are generated copies of the static product illustrations, not live app components. Provider marks and the font are embedded so they render without external dependencies. `blocks.ts` supplies their descriptions, installation commands and documentation destinations.

The two approved motion exports live in `public/home/hero` and `public/home/source`. They run in script-only sandboxed frames. The source frame accepts only numeric timeline messages from its parent, validating its origin against the referrer. The parent sends to that specific opaque frame window; the wildcard target origin is required by its sandbox. No credentials or product data cross this boundary. The GSAP distribution retains its license header.

Playback pauses offscreen, while the page is hidden, or when reduced motion is enabled. The hero has manual scene controls; the source has play/pause, replay and a scrubber. React effects clean up their observers and frame callbacks.

Run `bun dev:site`, then `bun test:visual:home` to capture desktop/mobile, a block dialog, the source sequence and FAQs. The capture uses reduced motion to keep results deterministic. Use `bun test apps/site/tests/home-assets.test.ts` to verify that exported dependencies, documentation targets and generated SVGs are present.
