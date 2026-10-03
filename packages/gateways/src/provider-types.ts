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

export type {
  StrictLiterals,
  ExtractModelIdFromProvider,
  ExtractImageModelIdFromProvider,
};
