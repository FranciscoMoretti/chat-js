# ChatJS Claude Instructions

Before changing any component, page, or styles, read the making-ui-changes skill and follow it - reuse before you create, add/update the story or capture in the same change, check the blast radius on shared components, and prove the change with a visual test.

When a registry tool in `packages/registry/src/tools/<id>` declares a `rendererExport` in its manifest, it must ship a `renderer.tsx` exporting it and a co-located `renderer.visual.tsx` browser test that renders it in every state in one snapshot. The `registry-coverage` unit test enforces this; run `bun run check` in `packages/registry` to verify types, unit, and visual tests.
