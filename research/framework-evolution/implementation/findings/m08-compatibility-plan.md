# Compatibility without building every permutation

Francisco's question: can selectable apps be type-safe and compatible without testing every possible combination? **Yes, with scoped guarantees and a boundary-driven validation plan. No, interfaces cannot establish universal behavioral compatibility.** Accepted direction remains JSON selection + standard shadcn/Eve installation + developer-owned composition. This report adds a testing strategy, not a plugin certification/version system.

## What is now executable

The [fixture](./m08-compatibility/README.md) reads actual M07 source at commit `b4f11884371768836dc5d84498a477b1ed19a07b`, makes temporary targets and verifies:

| Target | Actual source change | Observed checks | Not claimed |
| --- | --- | --- | --- |
| M07 baseline | Runtime source unchanged | Next type generation + strict TS, identity conformance, serialized tool output validation | This task did not repeat M07's real provider/restart/browser proof |
| Text-only | Removes note tool, schema, specialized message projection and renderer references | Same generated-app typecheck; identity checks; no remaining specialized note UI reference | Not a generic source-pruning implementation; pending-input support remains shared |
| External model + identity | Installs OpenAI-compatible 3.0.44 model factory in place of OpenAI 4.0.59; changes verified issuer to `acme-host` | Model fits actual AI SDK/Eve types; identity passes the same conformance fixture; app and renderer compile | `.invalid` model endpoint is never called; no external-provider operational support claim |

All three passed. Across them: **11 tests, 42 assertions**, four rejected semantic selections, and deliberately invalid unsuppressed `Binding` source rejected by each generated compiler invocation. Compile-only cases also require rejection of wrong identity return shape, wrong layout data, wrong model object and wrong renderer payload. [Evidence with versions/lock hashes](./m08-compatibility/evidence.json).

A particularly useful negative fixture is an identity function that always returns `alice`. It satisfies the real M07 TypeScript signature but fails the shared conformance tests. This is direct evidence that “same interface” and “safe replacement” are different properties. The suite checks missing credentials, a forged owner header, invalid signature, expired token, wrong audience/issuer and mutation origin. It is still not a complete identity-provider security audit, nor a replacement for M07's HTTP session-ownership tests.

The text-only app retains the same package lock: the removed note tool has no exclusive dependency. Zod remains required by application/router validation; Eve remains execution infrastructure. The external model variant changes the direct adapter and resolves a new independent Bun lock. Neither variant promises to strip Eve's vendored internal providers.

No production app/CLI file was changed. No app production build, service deployment, database, provider request or browser run occurred. Actual registry installation remains the separate [M08 omission spike](./m08-fixture/README.md), [R09](/Users/fran/.codex/worktrees/c997/chat-js/research/framework-evolution/implementation/findings/r09.md) and [R04](/Users/fran/.codex/worktrees/ceca/chat-js/research/framework-evolution/implementation/findings/r04.md) evidence; source substitutions here are not presented as a second external registry proof.

## The guarantee has four levels

1. **Selection is admissible.** Required services/capabilities exist, host is supported, exclusive choices do not conflict, and installation inputs have no unresolved collisions. This is data validation, not proof of runtime correctness.
2. **Composition is type-correct.** The generated application's actual imports and local configuration compile against its resolved dependencies. This catches interactions even when individual packages compile alone.
3. **Implementations conform.** Each adapter/component passes the reusable behavioral tests for the boundary it implements. These tests belong with that boundary and use the real adapter where relevant.
4. **A supported journey is demonstrated.** A representative real application exercises interacting boundaries: owner isolation, live tools, recovery, approval and cancellation as applicable. Only recorded journeys get operational support claims.

These are descriptions of evidence, not new runtime metadata or certification levels. An unlisted external option can install and typecheck without ChatJS claiming to maintain it. The builder should distinguish a documented supported starting configuration from an unverified custom combination rather than promise arbitrary swaps work.

## Contracts should make most choices independent

The design goal is local reasoning. A model adapter should not know which panel layout is used. A file adapter should not know which gateway is selected. A layout should consume view/workspace scope and actions, not directly operate Eve sessions. Every hidden dependency between otherwise independent choices makes the test matrix larger and is a reason to revisit that boundary.

Use the narrowest existing contract. Do not impose one giant interface that every provider claims to implement. A storage-backed tool requests required Files SDK behavior; code execution requests an actual sandbox; an image generator needs an image-capable model or its specified implementation. A general `LanguageModel` type alone does not prove a remotely selected model supports tools, images, structured output, or operational limits.

### Concrete compile boundaries from M07

```ts
// Infer from the installed application's actual public contract.
import type { caller } from "./lib/identity";
import type { Binding } from "./lib/application-client";
import type { ConfirmedNote } from "./lib/note-contract";

const identity: typeof caller = async (_request) => "alice";
// This shape compiles; verification behavior needs the contract test below.

// @ts-expect-error binding includes its durable session identity
const invalid: Binding = { conversationId: "id" };

const render = (value: ConfirmedNote) => value.note;
// @ts-expect-error renderer must consume the actual tool's inferred output
const wrong: typeof render = (value: { url: string }) => value.url;
```

The fixture compiles equivalent checks with real source. `Binding` is inferred through tRPC `inferRouterOutputs<AppRouter>`, and `ConfirmedNote` through the shared Zod output schema. Do not create a second handwritten provider/tool/result union. The external factory is checked using actual `LanguageModel` and `defineAgent` types; the UI example uses `ProjectData` for its component data contract. The UI task still owns its final scope/component API, so the fixture does not invent production UI types.

Runtime parsing is required at persisted/external boundaries. Compile-time generics cannot prove what comes over HTTP, survives persistence or comes from runtime-discovered MCP tools. Reject/fallback for incompatible output without violating execution or pending-input semantics. Model/tool catalogs are capability declarations, not definitive live behavior evidence.

### What semantic checks add

| Selection | Before-write result | Why TypeScript alone is insufficient |
| --- | --- | --- |
| M07 + Edge-only host | Reject for this recipe; requires Node execution | The TypeScript source may compile against broad ambient types |
| Saved-history UI omitted + no application binding | Reject missing durable ownership mapping | Optional transcript UI and session authorization are different responsibilities |
| Image tool + no writable file service | Ask for a compatible service, or reject noninteractive request | Selection arrives as unknown JSON; required factory dependencies are not instantiated yet |
| Two exclusive model defaults | Require an explicit choice | Both factories may separately typecheck |
| Files service shared by attachments + image tool | Reuse the one compatible selected service | Installing two copies is unnecessary and may create conflicting state |
| Two registry items write the same resolved target | Report a conflict before acceptance | Types only see whichever source survived installation |
| Two incompatible package requests / SDK peers | Report conflict and use upstream package resolution | Passing author compilation against a different lock proves little |
| Tool requires interactive approval but UI lacks usable input | Reject a promised interactive recipe or show explicit unavailable interaction | A renderer returning valid JSX may still omit essential controls |

The executable selector illustrates four rejections: wrong host, missing application binding, missing file-write requirement, conflicting exclusive model slot. It is deliberately not a semver solver, plugin system or production selection parser. Registry original-target collision detection remains the public-API limit documented in the [groundwork](./m08-registry-groundwork.md); do not represent flattened last-wins output as a complete preflight proof.

## Author conformance fixtures

Each extension point should own a small reusable suite that accepts the implementation and its necessary local/test resources. Authors supply an implementation fixture, not a complete fork of ChatJS. Official recommendations require relevant real evidence, while external installation remains open.

| Boundary | Reusable assertions | Real resource requirement |
| --- | --- | --- |
| Identity | Valid credential returns stable subject; missing/expired/forged/wrong-context credentials fail; no trusting caller-supplied owner | Real signing/verifier, simulated keys acceptable; host-specific revocation/rotation as applicable |
| Application binding/transport | Two valid owners isolated for all exposed operations; same-owner retries stable; ambiguous creation fails closed | Real disposable Postgres and HTTP boundary, using M07 suite |
| Model/execution | Accepted configured model; real stream/tool/structured-data modes claimed; mapped errors and cancellation semantics | At least one real supported model endpoint; no success claim from compiling a factory |
| Tool/companion | Shared inferred schema, final mounted names, malformed/unknown payload fallback, lazy load, no backend in browser | Pure schema tests + bundle inspection; real tool/renderer journey for recommendation |
| Files/document | Required reads/writes, authorization, stable reference/revision identity, failure and concurrent-update behavior | The actual Files SDK adapter/backend; a mock alone cannot establish its behavior |
| Sandbox | Executes supported request, isolates inputs, enforces timeouts/limits, returns expected failures | Actual supported sandbox implementation |
| Layout/view scope | Independent drafts/cursors, explicit action origin, panel unmount does not cancel a run, required input stays reachable | Component/browser test with controlled runtime; one integrated execution journey |
| Registry/add | Omitted source/exclusive dependencies absent, expected typed imports, edits preserved, setup clearly incomplete when required | Clean temporary generated projects and ordinary shadcn/Eve installation |

The first executable shared author suite here operates on `typeof caller` and runs unchanged for both issuer configurations. It deliberately fails an always-allow implementation. That establishes the testing pattern and some identity checks; it does not claim the other planned conformance suites already exist.

Avoid tests that only reproduce implementation code. Test observable guarantees and failure cases: unauthorized access is rejected, a missing renderer cannot approve a tool, failed persistence cannot be reported as a successful document revision. Adapter changes run their suite; changing the contract runs all known implementations of that contract.

## Select integration scenarios by interacting boundaries

Do not take a Cartesian product of every UI, gateway, storage and editor choice. Most combinations share the same edges. Maintain a short list of required interactions and one or more representative scenarios per edge, plus deliberate multi-boundary scenarios where failures cross several layers.

[Executable matrix](./m08-compatibility/matrix.ts) checks that every listed obligation has a row and demonstrates a missing full-reference row produces a gap. It selects rows affected by a changed boundary. **This validates coverage of the plan, not execution success.** [Matrix output](./m08-compatibility/matrix.json) preserves observed/partial/planned distinctions.

| Scenario | Boundary interactions it must exercise | Evidence today |
| --- | --- | --- |
| Minimal Next with approval | Identity ↔ transport; bindings ↔ execution; model ↔ execution; tool ↔ renderer; approval ↔ restart | M07 records real execution/restart/browser evidence; bounded semantics remain |
| Clean installed minimal | Selection ↔ registry graph ↔ generated source | Synthetic M08 installation/omission passes; actual M07 registry journey still needed |
| External model/identity swap | Model ↔ execution and identity ↔ transport | Actual generated typecheck + local identity tests pass; live external endpoint remains unverified |
| Two views / alternate composer | Layout ↔ view/action state | Consume UI task's actual tests; integrated goal-state scenario required |
| Document after branching | Files ↔ revisions ↔ history/execution ↔ authorization | Private prototype evidence is bounded; full production integration gate remains |
| Add into edited project | Registry ↔ existing composition ↔ mounted frontend | Layout preservation spike passed; full live paired-tool addition remains |
| Full resolved demo | All selected capabilities coexist; lifecycle/integration regressions | Planned M31, not claimed green here |

Pairwise coverage is a useful extra technique when many implementations share an edge. It cannot guarantee absence of three-way bugs; retain explicit cases for approval after restart, document revisions across branches, sharing/revocation and multi-view action routing. Unsupported combinations are not included as passing matrix entries.

### How the work scales

Suppose there are 4 model adapters, 3 layouts and 5 file adapters: 60 full apps. The initial evidence is roughly 12 implementation conformance fixtures, a few representative applications and high-risk edge tests—not 60 deployments. This is a planning illustration, not a numerical assurance: incompatible contracts, interaction-specific behavior or another infrastructure world can add necessary scenarios.

- **New layout:** layout/view contract + its generated-app typecheck + a browser interaction; no need to retest every file provider unless the layout introduces file behavior.
- **New file adapter:** real file conformance + one representative tool/document app + affected authorization/revision tests; no need to rebuild every theme.
- **New model adapter:** compile into actual Eve configuration + claimed live model modes + representative tool/approval journey; a different transport/protocol assumption deserves new coverage.
- **Shared schema or projection change:** typecheck known consumers and run all dependent renderer/serialization suites, then representative recovery/UI journeys. This change has a wider impact than swapping one provider.
- **SDK/Eve/framework upgrade:** reinstall pinned representative graphs, rerun their typechecks, boundary suites and real runtime journeys. Prior source-level compatibility is tied to its tested dependency graph.

An effect on an undeclared boundary is a defect in the dependency/contract inventory; the matrix cannot discover all hidden couplings automatically. Keep an honest change-to-boundary mapping rather than claiming a universal automatic impact analyzer.

## Proportionate CI and generated-project checks

**Every relevant pull request:** schema/selection negative checks; changed boundary conformance; typechecks of known representative generated apps; source/dependency omission and edit-preservation checks for installer changes. Shared-contract changes run all known consumer typechecks/conformance. No production build merely to typecheck.

**Live integration gate:** run affected supported model/storage/identity/execution journeys when those implementations or shared runtime boundaries change. Keep minimal and full-reference smoke/recovery tests as release gates. Do not defer a safety-critical changed boundary to occasional sampling just because the full matrix is expensive. Browser bundle/lazy checks apply to frontend/registry changes; backend-only changes need not rebuild every visual variant.

**Each user-generated app:** validate selection, materialize via upstream, run its actual typecheck when dependencies are installed, and provide explicit required local setup/smoke checks. A requested `--no-install` path cannot claim typecheck success. After developer edits, the project's tests/typecheck are authoritative; no attempt to reverse-engineer arbitrary React back into the starting selection.

**External author:** run the same boundary fixture and give one minimal install/use example with exact dependencies/source refs. The generated app typecheck protects the actual consumer even if the author's fixture used another lock. TypeScript passes only its static portion; an unavailable live backend is recorded as untested, not accepted by default.

This uses ordinary Bun lockfiles, upstream source pins, TypeScript and test runners. No custom release resolver, contract-version archive or certification server is needed.

## Inputs for the two consuming plans

**External extension contract inventory:** for each supported extension point, record the upstream/local type owner, semantic requirements, browser/server placement, shared behavioral fixture, one supported live example and limits. A frontend-only author needs no backend fixture. A model-only author needs no editor. Treat registry address, mounted runtime identity and UI placement as separate values. The shared contract suite follows the implementation category, never a central union of provider names.

**Whole-codebase UI goal-state plan:** identify the scope/data/actions each constituent consumes and its observable guarantees. Keep independent view draft/cursor behavior testable with controlled events; reuse M07's public projection and binding types at the execution boundary. Include paired input/approval fallback and lazy client-only rendering obligations. Types do not prove correct action targets or lifecycle ownership; two-view/browser scenarios do. Proposed composition filenames are accepted direction but final UI exports remain owned by that task.

Website builder remains deferred. It can later reuse selection validation and supported-case metadata, but its simulated preview is not execution conformance.

## Remaining decisions

No new architecture choice is needed to implement this plan. Use this proportionate validation approach as the next step under the accepted direction. Only a material future support claim needs Francisco's input: which real provider/host combinations ChatJS officially maintains, and whether cooperative cancellation/fail-closed ambiguous creation meet the promised product behavior. This report neither expands those promises nor makes them a blocker to building the shared checks.
