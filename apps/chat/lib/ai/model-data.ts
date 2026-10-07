/* oxlint-disable import/no-named-export -- Keep the named type bindings (ModelData); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export interface ModelData {
  readonly context_window: number;
  readonly description: string;
  readonly id: string;
  readonly input: {
    readonly image: boolean;
    readonly text: boolean;
    readonly pdf: boolean;
    readonly video: boolean;
    readonly audio: boolean;
  };
  readonly max_tokens: number;
  readonly name: string;
  readonly object: string;
  readonly output: {
    readonly image: boolean;
    readonly text: boolean;
    readonly audio: boolean;
    readonly video: boolean;
  };
  readonly owned_by: string;
  readonly pricing: {
    readonly input?: string;
    readonly output?: string;
    readonly input_cache_read?: string;
    readonly input_cache_write?: string;
    readonly web_search?: string;
    readonly image?: string;
  };
  readonly reasoning: boolean;
  readonly tags?: readonly string[];
  /** Undefined means the catalog does not declare tool support. */
  readonly toolCall: boolean | undefined;
  readonly type: "language" | "embedding" | "image" | "video";
}
/* oxlint-enable import/no-named-export */
