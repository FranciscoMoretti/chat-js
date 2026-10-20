# Single-agent worker memory comparison

This measures the worker topology change, not the complete hosted application or a Render capacity guarantee.

## Method

The baseline was archived from `8dbcc370c521a0d2a4472f328b922940fd18ee4f`, the candidate worktree's unchanged base. Its frozen lockfile was installed and both original EVE agents were built. The candidate uses the same dependency versions and its shared-agent implementation. The candidate measurement preceded the final canonical workflow-ID fix and model-policy refinements; these figures measure the topology candidate, not the exact final source revision. Both builds used EVE's normal `buildApplication` with only sandbox-image prewarming skipped; generated JavaScript was not patched or minified for the experiment.

Both scenarios ran with Node 24.20.0 in production mode on the same macOS host. The registered/shared worker used fresh databases in a dedicated loopback PostgreSQL 17 cluster for each trial. The original guest worker retained its original local workflow world; the candidate's guests use the shared PostgreSQL world. This difference is part of the proposed topology change, not a separate optimization. All application/model/storage credentials were synthetic; no live database, model call or storage operation was used.

Each trial started fresh worker processes, waited for genuine `/eve/v1/health` readiness, made ten additional health calls per worker, waited fifteen seconds, then sampled five times at one-second intervals. There was no debugger, heap snapshot, forced garbage collection, heap cap or special V8 tuning. A small preload recorded `process.memoryUsage()` and `v8.getHeapCodeStatistics()` once per second. The table reports medians of the per-trial five-sample medians across three trials. The baseline adds the registered and guest workers; the candidate has one shared worker.

Next.js, the PostgreSQL server, build processes, browser memory and model-turn workloads are excluded. These are short idle/readiness trials, not throughput, leak, recovery or saturation tests. Concurrent unrelated development servers caused substantial host memory pressure, making macOS resident-memory measurements particularly variable. Heap and external figures describe different allocations and must not be added to RSS.

## Results

| Worker memory (MiB) | Two workers, before | Shared worker, after | Difference |
| --- | --: | --: | --: |
| Used JavaScript heap | 142.8 | 96.3 | **46.5 less** |
| External allocations | 93.5 | 73.6 | **19.9 less** |
| Allocated JavaScript heap capacity | 283.0 | 212.2 | 70.8 less |
| Resident memory (RSS), noisy host | 508.5 | 242.3 | 266.2 less observed |

The heap/external result supports the expected reduction from removing a separately loaded EVE runtime. It does not isolate every dependency's cost, and the source includes the new policy/cleanup implementation as well as the topology change.

**Do not interpret the observed 266.2 MiB RSS difference as a reliable saving.** Baseline per-trial median RSS ranged from **240.8 to 547.3 MiB**, and candidate RSS from **190.4 to 334.2 MiB**. The overlapping ranges and changing host pressure prevent a precise resident-memory claim. Used heap ranged from 138.6–144.1 MiB before versus 94.7–104.5 MiB after; external allocations ranged from 93.5–94.1 MiB before versus 73.5–82.1 MiB after.

All six trials passed genuine worker readiness and all their health requests. All measured worker processes and the dedicated benchmark PostgreSQL cluster were stopped afterward.

Raw measurements and the harness are local ignored artifacts under `.next/memory-comparison/`. Do not use these startup numbers to promise that guest-enabled ChatJS fits Render's 512 MiB tier; a Linux quota test including Next.js and concurrent model turns is still required.
