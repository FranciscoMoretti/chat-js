# ChatJS video studio

Private production tooling for ChatJS marketing videos. This workspace is never published to npm. Remotion and rendering tools are development dependencies here; production apps and published packages must not import this workspace. Installing a published ChatJS package does not install the video tooling. A full monorepo contributor install includes workspace development dependencies.

## Preview and render

Use Bun from the repository root:

```sh
bun install
bun run --cwd apps/videos studio
bun run --cwd apps/videos render
```

The default render writes the 1920×1080, 30 fps Threads film to `apps/videos/out/threads-launch.mp4`. Run `bun run --cwd apps/videos render:brand` for the minimal brand card at `apps/videos/out/brand-example.mp4`. The first render downloads Remotion's headless browser. Generated videos and frame captures are ignored by Git. Local logo and font assets avoid runtime asset requests.

## Make the next video

1. Write a short story before animating: caption, control clicked, visible result, and reading hold for each beat. Use concrete actions and outcomes. Each caption must be proved by the next shot.
2. Copy a composition and register it in `src/index.tsx`. Keep scenario data and deterministic frame state separate from presentation.
3. Reuse `src/shared/brand.tsx` for the logo/fonts and `src/shared/presentation.tsx` for captions, pointer and click pulses. Use one clock for cursor and scene state; place the pointer inside the same transformed container as its targets.
4. Separate caption reading from UI action. Start with 1.25–1.75 second short captions and brief result holds; inspect at the intended viewing size.
5. Render key states and click frames, check backward seeking, then render the MP4. Run `bun lint` and `bun test:types`; decode the result with FFmpeg. Keep the prior approved render before revising.

Label simulated data in illustrated walkthroughs. Keep generated media outside Git; share approved output separately. Prefer small reusable presentation pieces; product-specific scenes belong to their own composition.

## Threads launch example

The approved 48-second film is documented in [THREADS.md](THREADS.md). `bun run --cwd apps/videos render` renders Threads; `render:brand` renders the minimal starter. The Threads script demonstrates regeneration, switching while streaming, separate follow-ups, and editing an earlier message while preserving both versions. Copy its scenario/state structure for the next guided film and reuse the shared presentation pieces.
