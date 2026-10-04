import type { ReactNode } from "react";

// A rendering consumer reads node data and preserves native callback/constructor contracts.
type ReadonlyNativeSurface<Value> = Value extends
  | string
  | number
  | boolean
  | bigint
  | symbol
  ? Value
  : Value extends (...parameters: readonly never[]) => unknown
    ? Value
    : Value extends abstract new (...parameters: readonly never[]) => unknown
      ? Value
      : Value extends object
        ? {
            readonly [Property in keyof Value]: ReadonlyNativeSurface<
              Value[Property]
            >;
          }
        : Value;

type ReadonlyReactNode = ReadonlyNativeSurface<ReactNode>;

export type { ReadonlyReactNode };
