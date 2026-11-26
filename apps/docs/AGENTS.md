# Documentation instructions

These instructions apply to `apps/docs/`.

## Project

- Author Blume MDX with YAML frontmatter.
- Keep navigation, theme, and settings in `blume.config.ts`.
- Search existing pages before adding content and make the smallest complete change.
- Run `bun docs:links` after changing internal links or navigation. To check the rendered links and anchors, run `bun run --cwd apps/docs build` followed by `bun run --cwd apps/docs docs:audit`.

## Information architecture

- `core/`: user-facing concepts, behavior, expectations, and configuration.
- `cookbook/`: implementation and modification recipes with concrete code paths.
- `reference/`: exhaustive lookup material such as variables, schemas, and defaults.
- Keep pages single-purpose and cross-link concepts, recipes, and references when readers need both.
- Update `blume.config.ts` and relevant overview pages when adding, moving, or removing pages.

## Writing

- Use second-person voice and put prerequisites before procedural steps.
- Include `title` and `description` frontmatter.
- Test code examples and add language tags to code fences.
- Use docs-root-relative page links such as `/core/architecture`. Blume adds the deployment base so the link works with or without a trailing slash. Use descriptive image alt text and Mermaid for diagrams.
- Avoid em dashes and semicolons in prose.
- Do not guess about behavior. Verify it against the code or request the missing decision.
