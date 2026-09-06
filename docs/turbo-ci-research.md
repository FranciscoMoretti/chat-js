# Turbo and CLI scaffold CI

Researched on 2026-09-06 against the official documentation and source tagged
`v2.10.12`. Recommendations below are specific to this repository.

## Version decision

Upgrade the exact Turbo pin from `2.9.5` to `2.10.12`. The npm `latest` metadata
and GitHub agree that this is a stable release, published on 2026-08-25.
[Registry metadata](https://registry.npmjs.org/turbo/latest),
[release](https://github.com/vercel/turborepo/releases/tag/v2.10.12).

The upgrade has relevant correctness fixes, not just performance improvements:

- Affected-task queries previously missed packages changed solely by resolved
  lockfile dependencies. [Fix #12900](https://github.com/vercel/turborepo/pull/12900).
- Queries now honor `TURBO_SCM_BASE` and `TURBO_SCM_HEAD`; explicit flags retain
  precedence. [Fix #12722](https://github.com/vercel/turborepo/pull/12722).
- Task-aware affected runs now correctly intersect package filters before adding
  execution dependencies. [Fix #13656](https://github.com/vercel/turborepo/pull/13656).
- Affected queries now retain virtual orchestration tasks with real dependencies.
  [Fix #13805](https://github.com/vercel/turborepo/pull/13805).

The basic query feature already existed in 2.9.5; the fixes are the reason to
upgrade. [2.9.5 query documentation](https://github.com/vercel/turborepo/blob/v2.9.5/apps/docs/content/docs/reference/query.mdx).

## Selection is separate from caching

`turbo query affected --tasks ... --packages ...` checks task inputs and upstream
task dependencies. Package-only queries are less precise. Supply both filters
when checking one CLI task. Parse `data.affectedTasks.length`; query failures must
fail CI rather than silently mean “unaffected.” With `--exit-code`, 0 means
unaffected, 1 means affected, and 2 means error.
[Query reference](https://github.com/vercel/turborepo/blob/v2.10.12/apps/docs/content/docs/reference/query.mdx).

Ordinary `turbo run --affected` selects packages. The opt-in
`futureFlags.affectedUsingTaskInputs` changes it to task-level selection. This update enables that flag because the existing Unit workflow queries tasks
and then runs with `--affected`: without the flag, CLI unit tests selected by
external template inputs could be omitted during execution. Regression tests
verify query and execution selection against the same Git changes. The scaffold
workflow runs its explicitly selected package task after its query gate. `$TURBO_ROOT$` inputs describe files outside a
package; `$TURBO_DEFAULT$` preserves default package inputs and Git-ignore
behavior. Explicit external globs need exclusions for generated files and local
state. `outputs` must include every artifact needed after a cache restoration.
[Configuration reference](https://github.com/vercel/turborepo/blob/v2.10.12/apps/docs/content/docs/reference/configuration.mdx).

Git history is required for meaningful affected detection. Use checkout
`fetch-depth: 0` and explicit PR base/head commit SHAs. Missing history causes
conservative selection of all packages, reducing speed rather than coverage.
[Run reference](https://turborepo.dev/docs/reference/run#--affected).

## Repository findings and recommended graph

The CLI build and unit-test scripts run `scripts/sync-template.ts`. That script
copies `apps/chat`, `apps/electron`, vendors `packages/thread/src`, transforms
several files, and reads root `package.json`. These dependencies are not declared
in the current CLI task inputs. The templates are ignored by Git, and the generic
build outputs include `dist/**` but omit `templates/**`. Consequently, a cached
CLI build can omit templates on a clean checkout or miss changed template
sources. These are findings from local source inspection, not Turbo defaults.

Recommended task design:

1. Give the CLI build and template-consuming unit tests explicit source inputs:
   CLI defaults, root sync script and package manifest, chat and Electron source,
   and thread source. Exclude generated outputs, dependencies, local environment
   files, and other paths the sync script deliberately excludes.
2. Cache both CLI `dist/**` and `templates/**` for the build. If unit tests remain
   responsible for template generation, declare their template outputs too, or
   move generation to one shared prerequisite. Do not introduce an application
   production build merely to express a source-copy dependency.
3. Add an uncached full scaffold task depending on the CLI build, and gate its
   execution with a task query. Include the scaffold runner and workflow in its
   inputs. Because it inherits the build dependency, changes to any consumed
   template source select it conservatively.
4. Automatically run the full package-manager installation matrix and Electron
   packaging when selected. Retain manual dispatch to run it regardless of Git
   changes. Keep the required workflow job present on unrelated PRs and report
   successful non-selection from inside the job.
5. Keep installation checks uncached: generated projects resolve dependency
   ranges against the live registry, so identical source hashes do not establish
   that today's installs work. Cache the reproducible CLI build separately.

Example selection command (task name illustrative):

```sh
bunx turbo query affected \
  --tasks test:scaffold \
  --packages @chat-js/cli \
  --base "$PR_BASE_SHA" \
  --head "$PR_HEAD_SHA"
```

Use the same task for selection and execution. Avoid an independent hand-written
path allowlist that can drift from the actual build inputs. Declaring only
manifest inputs would deliberately give up coverage of source-sensitive CLI or
Electron failures. Start conservatively, then narrow only when demonstrated safe.

## Validation to preserve before merging

Verify the real Turbo query against Git changes covering CLI source, sync script,
chat source/manifest, Electron source/manifest, thread source, workflow, root
manifest, and lockfile. Also verify a docs/site-only change does not select the
scaffold task. Confirm a CLI build cache hit restores templates on a clean
artifact directory. Run the full scaffold task, CLI unit tests, lint, and type
checks. Actual GitHub wall-clock savings remain an observation to make after CI.

Further improvements should be scoped separately: the generic `.next/**` output
currently includes Next cache/dev state, and broad `globalEnv` entries invalidate
unrelated tasks when application secrets change. Neither is necessary to make
scaffold selection correct. Turbo documents output exclusions and task-specific
`env` hashing as the corresponding controls.
[Task configuration](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks),
[environment variables](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables).

## Implemented validation

The task-query and dry-run execution regression suite covers 19 change scenarios,
including ignored build/dependency/local environment paths. A cache restoration
check removed both CLI artifact directories, observed a build cache hit, and
verified that the bundle and both template manifests were restored. CLI unit
tests, repository lint, and type checks pass locally. The full install/package
matrix is restored in CI; its new GitHub run remains the integration validation.
