type ReadonlyDeep<Value> = Value extends (...args: readonly never[]) => unknown
  ? Value
  : Value extends readonly unknown[]
    ? readonly ReadonlyDeep<Value[number]>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: ReadonlyDeep<Value[Key]> }
      : Value;

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReadonlyDeep); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ReadonlyDeep };
/* oxlint-enable import/no-named-export */
