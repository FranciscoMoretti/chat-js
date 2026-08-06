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
