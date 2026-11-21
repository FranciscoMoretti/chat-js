/** Optional web chat overrides. Omit modelIds to use the gateway catalog. */
export const webModels: {
  readonly model?: string;
  readonly modelIds?: readonly string[];
} = {};
