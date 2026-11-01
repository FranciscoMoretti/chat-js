import type { ReactNode } from "react";

import type { ReadonlyNativeSurface } from "./readonly-native-surface";

// Rendering readers retain the canonical native callback and constructor contracts.
type ReadonlyReactNode = ReadonlyNativeSurface<ReactNode>;

export type { ReadonlyReactNode };
