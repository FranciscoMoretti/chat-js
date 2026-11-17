# Native EVE tools with ChatJS UI

Agreed direction: classify agent behavior using native EVE categories, independently of ChatJS application dependencies. A tool can require ChatJS and include a rich result renderer. Artifact viewers are optional application plugins, not required by tools that generate files. Rich cards offer download without a viewer and an Open action when a compatible viewer is installed. Projects is being designed separately; Sharing stays in Plugins and Desktop in Setup.

## Implemented first slice: image generation

Image generation appears in Agent → Tools with a ChatJS badge. Its existing EVE execution and rich image renderer remain. The full-screen image viewer is an optional plugin using the existing typed UI slots. Copy/download remain available without it; installing the viewer adds Open. Generated installations type-check with and without the viewer. Builder interactions and downloads are covered on desktop/mobile, alongside real chat route captures. The preview uses a static sample image; it does not call an image provider.

## Implemented second slice: video generation

Video generation is in Agent → Tools with a ChatJS badge. Its card has an inline player and explicit download. The optional Video viewer plugin uses the same artifact action slot; opening it pauses the originating player. Playback is user-initiated. Unsupported video playback shows an unavailable state while retaining download. The builder uses a local sample video, not a provider call.

## Continue in order

1. Code execution: native EVE sandbox execution, chart/result rendering, optional viewers for generated files.
2. Documents and spreadsheets: investigate native sandbox file operations first. Decide retention, concurrent human/agent editing, and collaboration before replacing existing document persistence. Viewer/editor plugins must work for uploaded and generated files alike.
3. Research: assemble native EVE tools, instructions, subagents and workflow as an extension, with application progress rendering and optional document integration.

Do not require standalone portability, introduce a second execution mechanism, or turn source attribution into an implied application dependency. Keep ChatJS authorization at its resource boundary. The first artifact display reference uses the existing authenticated file URL; it does not grant additional access or define the future sandbox storage model.
