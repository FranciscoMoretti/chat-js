# Validation profile — 2026-10-25

Decision: retain real shadcn filesystem staging. Rendering is below the preselected 20% materiality threshold in all representative cases; direct staging work is a smaller share still. An in-memory installer would need to reproduce shadcn's filesystem-sensitive import resolution, which full-tree parity showed matters.

Measured locally on Apple M5 Pro, macOS arm64, Bun 1.3.11, TypeScript 6.0.2, with workspace dependencies already installed, including the final core schema-helper pin. Three serial samples per case, rotating case order; no concurrent test suite ran during measurement. Results are medians, not CI speed claims. Clean-core preparation took 323 ms once.

| Case | Render including cleanup | TypeScript | Rendering share | Context writes + collection + cleanup |
| --- | --: | --: | --: | --: |
| Minimal OpenAI | 671 ms | 5,068 ms | 11.7% | 84 ms |
| Shared chat contributions | 777 ms | 5,060 ms | 13.3% | 102 ms |
| Full installation preset | 1,053 ms | 6,375 ms | 14.2% | 98 ms |

The last column sums the separate phase medians. These phases include some orchestration beyond filesystem calls. Shadcn installation combines transformations and writes (35–374 ms median); planning and provider/registration configuration account for much of the remaining render cost. Phase medians do not necessarily add to the median total. Even eliminating the entire rendering phase would save only the rendering share; removing filesystem operations alone would save less.

[Raw samples and phase measurements](validation-profile.results.json) include all nine runs, file counts and environment details. `nodeCompatibility` is Bun's reported Node compatibility version, not a separate Node benchmark.

Reproduce after installing dependencies and preparing the same library/template inputs as the matrix:

```sh
bun run --cwd packages/registry test:installation
bun run --cwd packages/registry profile:validation
```

Revisit the decision if CI measurements show rendering above 20%, or if a larger registry/project changes the balance. Keep full-tree real-install parity as the acceptance criterion for any replacement. TypeScript checking currently offers the larger potential improvement, but compiler reuse/caching is outside this milestone.
