/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
export type StrictLiterals<T> = T extends string
  ? string extends T
    ? never
    : T
  : T;
/* oxlint-enable eslint/id-length */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type ExtractModelIdFromProvider<ProviderFactory> =
  ProviderFactory extends (...args: infer _Args) => infer Provider
    ? Provider extends {
        languageModel: (
          modelId: infer ModelId,
          ...args: infer _Rest
        ) => unknown;
      }
      ? ModelId
      : never
    : never;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type ExtractImageModelIdFromProvider<ProviderFactory> =
  ProviderFactory extends (...args: infer _Args) => infer Provider
    ? Provider extends {
        image: (modelId: infer ModelId, ...args: infer _Rest) => unknown;
      }
      ? ModelId
      : never
    : never;
/* oxlint-enable import/group-exports */
