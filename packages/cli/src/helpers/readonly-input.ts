// Generator inputs are parsed schema data. Readonly projections expose the same
// fields and primitive values while preventing mutation of nested collections.
type ReadonlyInput<Value> = Value extends object
  ? { readonly [Property in keyof Value]: ReadonlyInput<Value[Property]> }
  : Value;

export type { ReadonlyInput };
