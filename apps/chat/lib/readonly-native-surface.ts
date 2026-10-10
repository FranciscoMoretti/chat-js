// Preserve every native member and its callable contract while marking data readonly.
type ReadonlyNativeSurface<Value> = Value extends
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
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

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReadonlyNativeSurface); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ReadonlyNativeSurface };
/* oxlint-enable import/no-named-export */
