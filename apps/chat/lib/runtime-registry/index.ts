/**
 * Runtime registry public API.
 *
 * This folder is the package-like boundary for the reusable multi-runtime
 * layer. Consumers should import from `@/lib/runtime-registry` instead of reaching
 * into individual files.
 *
 * Responsibilities owned here:
 * - one runtime per opaque runtime id
 * - runtime registry/provider state
 * - mounted background slots for app-provided runtime controllers
 *
 * Responsibilities intentionally kept outside this boundary:
 * - runtime id construction/parsing
 * - route parsing and route policy
 * - app-specific context
 * - persistence/confirmation state
 * - persisted query loading and cache invalidation
 * - store creation and store providers
 * - app-specific state shape
 * - UI
 * - concrete background controllers
 */

/**
 * App-facing convenience API.
 * Prefer these hooks over using the registry context directly from feature code.
 */
export {
  type RuntimeActions,
  useRuntime,
  useRuntimeActions,
} from "./runtime-api";

/**
 * Runtime registry provider and runtime slot renderer.
 * Mount `RuntimeRegistryProvider` near the app root and `RuntimeSlots`
 * once outside the route tree.
 */
export {
  type CreateRuntimeInput,
  type Runtime,
  type RuntimeId,
  RuntimeRegistryProvider,
  RuntimeSlots,
  useRuntimeRegistry,
} from "./runtime-registry-provider";
