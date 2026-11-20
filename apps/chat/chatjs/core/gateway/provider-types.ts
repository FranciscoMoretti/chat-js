type StrictLiterals<TValue> = TValue extends string
  ? string extends TValue
    ? never
    : TValue
  : TValue;

// Null capabilities have no configurable IDs; supported factories retain SDK suggestions.
type ConfigMediaModelId<Factory extends ((modelId: string) => unknown) | null> =
  Parameters<NonNullable<Factory>>[0];

export type { ConfigMediaModelId, StrictLiterals };
