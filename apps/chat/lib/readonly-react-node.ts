import type { ReactNode } from "react";

import type { ReadonlyNativeSurface } from "./readonly-native-surface";

// Rendering readers retain the canonical native callback and constructor contracts.
type ReadonlyReactNode = ReadonlyNativeSurface<ReactNode>;

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReadonlyReactNode); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ReadonlyReactNode };
/* oxlint-enable import/no-named-export */
