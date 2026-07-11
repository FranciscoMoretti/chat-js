# Chat application instructions

These instructions apply to this application directory.

## Stack and structure

- Use Next.js App Router, React, the Vercel AI SDK, Tailwind CSS 4, and shadcn/ui.
- Keep shadcn primitives in `components/ui`; its config is `components.json`.
- Chat requests enter through `app/(chat)/api/chat/route.ts`.
- Keep Drizzle schema in `lib/db/schema.ts` and database operations in
  `lib/db/queries.ts`.
- Register every tRPC router in `trpc/routers/_app.ts`.

## Commands

- Type-check with `bun test:types`; do not use a production build as a type
  check.
- Run `bun lint` after TypeScript, React, JSON, or CSS changes.
- For authenticated browser testing, visit `/api/dev-login` on the discovered
  local app URL before testing.

## Database changes

1. Change `lib/db/schema.ts`.
2. Run `bun db:generate`.
3. Review the generated migration.
4. Run `bun db:migrate` only when applying the migration is in scope.

## Environment and configuration

- Define and access environment variables through `lib/env.ts`; prefer
  `env.VAR_NAME` over `process.env.VAR_NAME` in application code.
- Keep feature flags and integration configuration in `lib/config.ts`.
- When a feature requires environment variables, add matching validation to
  `scripts/check-env.ts`.

## TypeScript and React

- Avoid `any` and type assertions, including `as unknown as`. Fix the types
  instead of suppressing them.
- Do not create barrel files. Use direct imports and named exports.
- Define one-off object parameter types inline on the function instead of
  creating a separate interface.
- Use function components and keep non-interactive work in Server Components.
  Add `"use client"` only for interactive components.
- Follow the Rules of Hooks; never call hooks conditionally or in loops.
- Derive values instead of duplicating them in state. Keep effects narrowly
  focused on side effects.
- Use `react-hook-form` with Zod and shadcn Form primitives for non-trivial
  forms. Co-locate schemas that are not reused.
- Prefer responsive Tailwind classes over JavaScript viewport checks when CSS
  can express the behavior.
- Use the shared `cn` helper for conditional classes.

## Code quality

- Use `const` by default, `for...of` for iteration, optional chaining, nullish
  coalescing, and descriptive names instead of magic values.
- Await promises and handle errors deliberately. Do not use async promise
  executors or `done` callbacks.
- Prefer early returns and named conditions over deeply nested logic or nested
  ternaries.
- Keep regular expressions at module scope when reused or evaluated in loops.
- Avoid spread-based accumulators in loops.
- Remove `console.log`, `debugger`, and `alert` from production code.
- Use semantic HTML, meaningful alt text, proper headings, input labels, and
  keyboard support for interactive elements. Add `rel="noopener"` with
  `target="_blank"`.
- Avoid `dangerouslySetInnerHTML`, `eval`, and direct `document.cookie`
  assignments unless the task explicitly requires and secures them.
- Use Next.js `Image` instead of raw `img` elements.
- Keep test assertions inside test cases. Do not commit `.only` or `.skip`.
- Run `bunx ultracite@7.4.3 check` to inspect formatting and lint failures, or
  `bunx ultracite@7.4.3 fix` when formatting changes are in scope.
