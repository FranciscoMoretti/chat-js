# ChatJS videos

The approved Threads launch film migrated to native React/Remotion. A 48-second, 1920×1080 composition at 30 fps, with ChatJS branding and deterministic simulated replies. No HTML iframe, DOM mutation playback, Playwright capture loop, API credentials, or network response timing is involved in rendering.

## Preview and render

From the repository root, after `bun install`:

```sh
bun run --cwd apps/videos studio
bun run --cwd apps/videos render
bun run --cwd apps/videos stills
bun run --cwd apps/videos test:unit
```

Studio provides named timeline sections and frame scrubbing. The MP4 is written to `apps/videos/out/threads-launch.mp4`; representative PNGs go to `out/stills`. Outputs are ignored by Git. Remotion downloads its headless browser on first use. All fonts and images are bundled locally.

## Editing the next film

- `src/story.ts`: typed content, captions, chapter times, branch states, and cursor actions. Change the `script` object to tell another story with the same structure.
- `src/threads-launch.tsx`: React chat, tree, status, brand, and title-card components. Every animated value derives from the current frame. Do not introduce timers or CSS animation.
- `src/index.tsx`: composition registration, dimensions, fps, and default props. Register another composition here for a separate film.
- `src/styles.css`: the approved visual design, ported from the illustrated walkthrough.
- `public/brand`: ChatJS logo and Geist/Geist Mono font assets copied from the site. The SVG uses the navbar logo paths with transparent cutouts.

Content can also be overridden through Remotion input props (`--props=path/to/props.json`) with a complete `content` object matching `LaunchScript`.

This is deliberately one reusable launch-film composition, not a general video editor. Structural changes such as adding another branch or changing the timeline require adjusting the state function and tree layout. Portrait and square layouts have not been implemented.

## Quality and verification

The previous film captured at 15 fps and duplicated frames into a 30 fps file. This composition renders 30 distinct frames per second, using lossless PNG intermediates before H.264 encoding (CRF 18). The current cut uses the same design with revised copy and editing the original prompt to create a Porto conversation.

`test:unit` protects background streaming and branch context. `stills` renders every chapter's meaningful state and checks repeated out-of-order rendering for deterministic output. The root `bun lint` and `bun test:types` include this workspace.

The film is an illustrated walkthrough with simulated replies, not a live product screen recording. The install card is a launch asset and does not verify npm publication.

Remotion references: [composition fundamentals](https://www.remotion.dev/docs/the-fundamentals), [render CLI](https://www.remotion.dev/docs/cli/render), [local fonts](https://www.remotion.dev/docs/fonts-api/load-font).

## Current edit: two paths, one story

- 0–3s: npm package introduction.
- 3–8s: original answer streams, then a short reading hold.
- 8–9.5s: “Try another answer” caption.
- 9.5–14.5s: explicit regenerate press; reveal the split.
- 14.5–16s: “Switch while replies stream” caption.
- 17s: press the previous-answer arrow; original returns while the alternative streams, with a live word count and progress bar showing continued generation.
- 20.5–22s: “Continue either conversation” caption.
- 22–26.5s: kid-friendly follow-up and a short reading hold.
- 26.5–28s: “Continue the other” caption.
- 29s: press the next-answer arrow.
- 30–34.5s: vegetarian follow-up.
- 34.5–36s: “Edit any message. Keep both versions.” caption.
- 36–39.3s: reveal the original prompt, click Edit, change Lisbon to Porto, then Save.
- 39.3–43s: Porto reply streams; both Lisbon conversations remain in the tree.
- 43–48s: installation and URL.

The three-reply/stop sequence is omitted from this film. Earlier MP4s remain in `out/threads-launch-before-caption-beats.mp4` and `out/threads-launch-caption-cut.mp4`. The original approved render is preserved outside Git; this example consumes the shared branding, captions, pointer, and click effects.
