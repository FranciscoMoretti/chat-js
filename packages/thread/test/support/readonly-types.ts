type ReadonlyDeep<Value> = Value extends (...args: readonly never[]) => unknown
  ? Value
  : Value extends readonly unknown[]
    ? readonly ReadonlyDeep<Value[number]>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: ReadonlyDeep<Value[Key]> }
      : Value;

export type { ReadonlyDeep };
