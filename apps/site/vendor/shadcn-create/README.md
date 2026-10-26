# shadcn Create source

This directory vendors the Create interface and mechanism from [shadcn/ui](https://github.com/shadcn-ui/ui), commit `481d523374745e77d0cf9c53a4115ab5dd7c8481`. The upstream MIT license is retained in [LICENSE.md](./LICENSE.md).

Source locations:

- `components/`, `hooks/`, and `lib/`: `apps/v4/app/(app)/(create)/`.
- `registry/`: the upstream registry configuration, colors, themes, styles, bases, and font definitions.
- `preview/`: upstream preview font loading and variable installation.
- `styles/base-nova/ui/`: native generated components from `https://ui.shadcn.com/r/styles/base-nova`. Their source hashes are recorded in `provenance.json` in that directory. Regenerate with `bun apps/site/scripts/generate-create-shell.ts`.

The upstream preset codec, URL state, color compatibility rules, transient hover preview, randomization, locks, preset history, open-preset parsing, reset, and font/theme application remain the implementation. Import aliases are redirected into this vendor directory. Zod imports use `zod/v3` to match the schemas exported by shadcn.

ChatJS adaptations:

- The host route uses ChatJS navigation, the native customizer and preview shell, and the existing ChatJS presentation fixture in the iframe. The fixture shares the app's PromptForm layout and uses generated native Message, Bubble, MessageScroller, Attachment and input/menu components for all eight styles; it does not embed the production Lexical editor, EVE, authentication, or server runtime.
- `Preview` loads `/create/preview`, retains the upstream `design-system-params` channel and hover override mechanism, and adds the separate ChatJS installation synchronization boundary. Preview items are ChatJS conversation, new chat, and tool states. Desktop/mobile size controls use the existing upstream `size` query parameter.
- Native `DesignSystemProvider` and upstream self-hosted Next font loaders apply the preset. Body and heading font variables also reach portaled content. No separate theme schema or remote theme resolution API is used.
- The iframe presentation consumes the native provider's resolved query state through a typed React context. This keeps its component library, direction and preset aligned with the provider when selections change during iframe hydration, without duplicate query subscriptions or a separate state model.
- The authored `components/create-preview/project-form.tsx` adapts the upstream dialog, fields, tabs, and theme output for ChatJS installation options. It uses existing installation metadata/schema and emits the native preset/base/pointer/RTL options to the CLI. ChatJS owns its Next.js scaffold; Base UI and Radix use their native preview components and CLI base argument. Unsupported frameworks and React Aria cannot produce a command or a misleading preview.
- Storage choices are limited to verified Vercel Blob, S3, and R2 integrations. Only declared public config fields are accepted or shared. Credentials are configured after generation.
- Share and copy report browser clipboard failure. Share rebuilds a link from known public options. No analytics tracking is sent.
- Preview scene changes from either control surface commit through the host URL. The iframe replays the latest design parameters on its ready handshake, and a loading/retry overlay handles stalled preview navigation. The host requests a new readiness acknowledgment when browser history restores an iframe before its listener mounts. Preset history starts from the first settled URL, so opening a shared preset does not create an undo entry.
- History ignores an undo/redo acknowledgment only when it matches the selected history entry. A new edit that settles before a throttled Undo write still clears the redo branch.
- Iframe messages and forwarded shortcuts target and validate the same origin and expected window. The native dynamic icon placeholder is a small authored adapter for only the four shell glyphs used here; app-owned preview icons remain Lucide.
- Upstream docs/explorer navigation, v0 publishing, development-only preview tools, and the upstream onboarding dialog are not part of the ChatJS Create product.

Keep modifications small and record future deviations here. Vendor source retains upstream formatting; authored integration modules follow repository lint rules. Unit tests cover the imported codec/query seams, and the Create browser test covers interactions and visual states.

The native preview generator accepts `base` (default) or `radix`: `bun apps/site/scripts/generate-create-preview.ts radix`. Radix components live alongside Base in `components/create-preview/ui/radix-<style>`, with separate `provenance-radix.json` hashes. Source adaptations are import destinations and upstream menu/direction transforms; preview composition uses native `render` or `asChild` triggers for the selected library.

The generated preview primitives use native `transformDirection` so logical spacing, directional icons and submenu placement work in either reading direction. Preview and generated app roots provide the selected library’s native DirectionProvider; generated app direction comes from `components.json.rtl`.
