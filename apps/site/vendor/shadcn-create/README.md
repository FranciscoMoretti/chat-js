# shadcn Create source

This directory vendors the Create interface and mechanism from [shadcn/ui](https://github.com/shadcn-ui/ui), commit `481d523374745e77d0cf9c53a4115ab5dd7c8481`. The upstream MIT license is retained in [LICENSE.md](./LICENSE.md).

Source locations:

- `components/`, `hooks/`, and `lib/`: `apps/v4/app/(app)/(create)/`.
- `registry/`: the upstream registry configuration, colors, themes, styles, bases, and font definitions.
- `preview/`: upstream preview font loading and variable installation.
- `styles/base-nova/ui/`: native generated components from `https://ui.shadcn.com/r/styles/base-nova`. Their source hashes are recorded in `provenance.json` in that directory. Regenerate with `bun apps/site/scripts/generate-create-shell.ts`.

The upstream preset codec, URL state, color compatibility rules, transient hover preview, randomization, locks, preset history, open-preset parsing, reset, and font/theme application remain the implementation. Import aliases are redirected into this vendor directory. Zod imports use `zod/v3` to match the schemas exported by shadcn.

ChatJS adaptations:

- The host route uses ChatJS navigation and the native customizer and preview shell. The iframe consumes the standard ChatJS sidebar, account menu, conversation header, transcript, Lexical composer, model picker and artifact layout. It supplies local session, model, tRPC and navigation adapters; it does not start EVE, authentication or provider services.
- `Preview` loads `/create/preview`, retains the upstream `design-system-params` channel and hover override mechanism, and adds the separate ChatJS installation synchronization boundary. Preview items are ChatJS conversation, new chat, and tool states. Desktop/mobile size controls use the existing upstream `size` query parameter.
- Native `DesignSystemProvider` and upstream self-hosted Next font loaders apply the preset. Body and heading font variables also reach portaled content. No separate theme schema or remote theme resolution API is used.
- The iframe presentation consumes the native provider's resolved query state through a typed React context. This keeps its component library, direction and preset aligned with the provider when selections change during iframe hydration, without duplicate query subscriptions or a separate state model.
- The authored `components/create-preview/project-form.tsx` adapts the upstream dialog, fields, tabs, and theme output for ChatJS installation options. It uses existing installation metadata/schema and emits the native preset/base/pointer/RTL options to the CLI. ChatJS owns its Next.js scaffold. Get Code offers Base UI and Radix UI as installation choices through the native CLI base argument. The shared application preview stays on Base UI for either selection; the dialog explicitly labels this boundary. Only the pointer switch is exposed; monorepo and RTL controls are omitted. Unsupported frameworks and React Aria cannot produce a command or a misleading preview.
- Storage choices are limited to verified Vercel Blob, S3, and R2 integrations. Only declared public config fields are accepted or shared. Credentials are configured after generation.
- Share and copy report browser clipboard failure. Share rebuilds a link from known public options. No analytics tracking is sent.
- Preview scene changes from either control surface commit through the host URL and the native message channel without reloading the iframe, preserving local plugin data. Only the conversation scene state resets; changing the installation library keeps the same Base UI iframe and local data. The iframe replays the latest design parameters on its ready handshake, and a loading/retry overlay handles stalled preview navigation. The host requests a new readiness acknowledgment when browser history restores an iframe before its listener mounts. Preset history starts from the first settled URL, so opening a shared preset does not create an undo entry.
- History ignores an undo/redo acknowledgment only when it matches the selected history entry. A new edit that settles before a throttled Undo write still clears the redo branch.
- Iframe messages and forwarded shortcuts target and validate the same origin and expected window. The native dynamic icon placeholder is a small authored adapter for only the four shell glyphs used here; app-owned preview icons remain Lucide.
- Upstream docs/explorer navigation, v0 publishing, development-only preview tools, and the upstream onboarding dialog are not part of the ChatJS Create product.

Keep modifications small and record future deviations here. Vendor source retains upstream formatting; authored integration modules follow repository lint rules. Unit tests cover the imported codec/query seams, and the Create browser test covers interactions and visual states.

The preview imports one canonical component set per library from `apps/v4/registry/bases/{base,radix}/ui` at the commit above. They live in `components/create-preview/ui/{base,radix}`. The eight upstream `registry/styles/style-*.css` files and `app/style-registry.css` provide appearance through the provider's body style class. Menus retain upstream `cn-menu-target` and `cn-menu-translucent` markers: the unmodified native provider effect manages inversion and translucency, including portaled content and appearance changes while a menu is open. Styles and menu colors never select another component implementation.

Run `bun apps/site/scripts/generate-create-preview.ts` to sync both libraries and CSS; add `--check` to fetch the immutable sources and verify the complete imported inventory byte-for-byte. `ui/provenance.json` records the commit, raw upstream hashes, adapted hashes, and the exact shadcn package version used for the RTL transform. There are no live registry lookups in this importer. The upstream MIT license above also covers these imports.

The scene switcher occupies a labeled toolbar above the iframe. Preview-only controls stay outside the shared chat header and cannot cover the composer.

## Approved presentation boundary

Create deliberately follows shadcn Create's architecture: its preview uses pinned canonical upstream primitives and live style CSS, while scaffolded apps use installed shadcn primitives for their selected preset. This difference is intentional; do not replace it with duplicated per-style variants or require both environments to import identical primitive files. Keep upstream imports pinned and reproducible, with minimal explicit adaptations. Validate appearance with equivalent presets, direction and viewport.

Above that primitive boundary, production, scaffolded apps and Create consume the same standard ChatJS compositions for the complete sidebar, conversation header, transcript and composer controls, including their plugin insertion points. Production retains server-streamed sidebar data and real effects; Create supplies sample data, local mutations and scene navigation instead of independently assembling these surfaces. Keep small composable components and genuine plugin extension slots; broad replacement slots must not become parallel implementations of the standard app UI.

Local adapters exercise rename, pin, delete, project management, feedback, credits, search, file selection, model selection, message editing, submission/error states and a text-document panel. Replies, regeneration and edit results remain simulated; they do not certify AI generation, branching, uploads to storage or multi-model execution. Settings and account destinations are explicitly unavailable in the preview; project selection shows the conversation scene rather than a full project page. Unsupported plugins retain an explicit preview-coverage label. Appearance choices continue through shadcn's mechanism; optional plugin UI continues through the existing plugin slots. An exclusive UI-slot mechanism is deferred until a concrete selection requires it.

Explicit preview adaptations:

- Redirect component and icon imports locally, and stylesheet references to the site's existing theme definitions. `preview.css` supplies the upstream `no-scrollbar` utility and missing sidebar token aliases, and preserves the preview's preset font variables and Tailwind font stacks when referencing the host theme.
- Apply the pinned shadcn `transformDirection` to TSX and to each CSS `@apply` utility list, parsed with PostCSS. This preserves logical spacing and directional icons without creating separate RTL variants. The preview root keeps the selected library's native DirectionProvider. Generated app direction still comes from `components.json.rtl`.
- The shared scene uses the production Base `render` API. Radix installation remains a CLI concern, using its existing registry adaptations. ChatJS scenes, installation synchronization, controls, and CLI handoff remain authored integration code.
