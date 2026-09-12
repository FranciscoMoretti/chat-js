# Runtime Registry

`@/lib/runtime-registry` is a generic route-independent runtime registry.

It solves the problem of keeping long-lived app work alive independently of the currently rendered route. A route can register a runtime by opaque `runtimeId`; the registry keeps exactly one runtime for that id, and `RuntimeSlots` renders one background slot for each registered runtime. The slot receives the runtime's app-owned `data` and decides what to mount, such as stores, subscriptions, controllers, or effects.

This package owns only the generic runtime lifetime mechanics. App-specific runtime ids, stores, persistence, routing, and UI live outside this boundary.

Consumers should import from `@/lib/runtime-registry`, not from individual files.

## Mental Model

A runtime is a stable non-empty `runtimeId` plus typed app-owned data.

The registry owns the active runtime list. Consumers create runtimes through provider initial state, event handlers, or committed effects. `RuntimeSlots` renders one background slot per registered runtime and passes that typed runtime to the slot renderer.

```txt
RuntimeRegistryProvider
  owns runtimes

RuntimeSlots
  runtime(runtime A)
    children(runtime A)

  runtime(runtime B)
    children(runtime B)
```

The package does not define what the mounted children do.

## Lifecycle

Seed initial runtimes when the provider mounts:

```tsx
<RuntimeRegistryProvider initialRuntimes={[{ runtimeId, data }]}>
  <App />
</RuntimeRegistryProvider>
```

Create a runtime after mount from an event handler or committed effect:

```ts
const { ensureRuntime } = useRuntimeActions<RuntimeData>();

ensureRuntime({ runtimeId, data });
```

`ensureRuntime` is idempotent. If a runtime with the same id already exists, it leaves the existing runtime and its original data unchanged.

Render code should use `useRuntime(runtimeId)` for reads. It should not create runtimes.

Render background runtime slots once near the app root:

```tsx
<RuntimeRegistryProvider initialRuntimes={initialRuntimes}>
  <RuntimeSlots<RuntimeData>>
    {(runtime) => <RuntimeSlot runtime={runtime} />}
  </RuntimeSlots>
  <AppRoutes />
</RuntimeRegistryProvider>
```

Read a runtime by id:

```ts
const runtime = useRuntime<RuntimeData>(runtimeId);
```

## Public API

### `RuntimeRegistryProvider`

Top-level provider for runtime registry state.

Mount it above code that calls runtime hooks. It accepts optional `initialRuntimes`, used once to seed runtimes during provider initialization.

### `RuntimeSlots`

Calls its render function once for each registered runtime.

### `useRuntimeActions()`

Returns the mutating runtime lifecycle API:

```ts
interface RuntimeActions<TData> {
  ensureRuntime(input: CreateRuntimeInput<TData>): void;
}
```

Call this from event handlers or committed effects, not from render.

### `useRuntime(runtimeId)`

Returns the typed runtime when it is registered, or `null` when there is no runtime.

### `useRuntimeRegistry()`

Low-level registry context. Prefer `useRuntimeActions`, `useRuntime`, and `RuntimeSlots` in feature code.

## Types

```ts
type RuntimeId = string;

interface Runtime<TData = unknown> {
  runtimeId: RuntimeId;
  data: TData;
}

interface CreateRuntimeInput<TData = unknown> {
  runtimeId: RuntimeId;
  data: TData;
}
```
