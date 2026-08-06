# ChatJS Agent Instructions

## Repository

- Use Bun for packages and scripts.
- The monorepo contains applications in `apps/` and shared packages in
  `packages/`.
- Run `bun lint`, `bun test:types`, and the relevant tests before handing off
  code changes. Do not run a production build merely to type-check.

## Agent guidance

- Repository rules follow [agents.md](https://agents.md/) and live in
  `AGENTS.md` files. The nearest file in the directory tree adds to or overrides
  this file for its subtree.
- On-demand workflows live in `.agents/skills/<name>/SKILL.md` and follow the
  [Agent Skills specification](https://agentskills.io/specification).
- Prefer concrete code and evidence over high-level advice. Keep communication
  concise.
- Remove unused code rather than preserving compatibility aliases or dead
  exports.

## Testing

- Use the [strategic-testing](.agents/skills/strategic-testing/SKILL.md) skill
  when deciding whether to add or change tests.

## Learned User Preferences

- Prefer long-term clean adoption over incremental opt-out paths when both are
  offered.
- When addressing PR review comments, reply and resolve clear threads; discuss
  non-trivial or ambiguous ones before changing code.
- Prefer the agent's recommended option when a multi-option plan is proposed.
- Keep continual-learning `AGENTS.md` edits and local research notes out of
  feature PRs unless explicitly asked to include them.

## Learned Workspace Facts

- Ship chat-app changes for new installs via `@chat-js/cli` Changesets (template
  sync); `@chatjs/chat` is private.
- Keep the Next.js-managed `nextjs-agent-rules` block in `apps/chat/AGENTS.md`
  and commit it with related Next upgrades.
- Instant Navigation App Shell quality depends on keeping durable chrome (for
  example `AppSidebar`) outside cookie/session Suspense; shells under a high
  Suspense boundary will not appear in Navigation Inspector.
- Local chat verification should use `http://localhost:3030` (not `127.0.0.1`)
  with `/api/dev-login` so session cookies stick.
- `ChatRouteHost` must keep route `{children}` mounted (hidden is fine) so
  Instant Nav can validate page segments.
- Repo-level Instant Nav skills live under `.agents/skills/`:
  `next-cache-components-adoption`, `next-partial-prefetching-adoption`, and
  `next-dev-loop`.
