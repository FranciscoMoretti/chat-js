type StrictLiterals<TValue> = TValue extends string
  ? string extends TValue
    ? never
    : TValue
  : TValue;

type ExtractModelIdFromProvider<ProviderFactory> = ProviderFactory extends (
  ...args: infer _Args
) => infer Provider
  ? Provider extends {
      languageModel: (modelId: infer ModelId, ...args: infer _Rest) => unknown;
    }
    ? ModelId
    : never
  : never;

type ExtractImageModelIdFromProvider<ProviderFactory> =
  ProviderFactory extends (...args: infer _Args) => infer Provider
    ? Provider extends {
        image: (modelId: infer ModelId, ...args: infer _Rest) => unknown;
      }
      ? ModelId
      : never
    : never;

// Null capabilities have no configurable IDs; supported factories retain SDK suggestions.
type ConfigMediaModelId<Factory extends ((modelId: string) => unknown) | null> =
  Parameters<NonNullable<Factory>>[0];

export type {
  ConfigMediaModelId,
  StrictLiterals,
  ExtractModelIdFromProvider,
  ExtractImageModelIdFromProvider,
};
