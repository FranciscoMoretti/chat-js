/* oxlint-disable import/no-named-export -- Keep the named type bindings (ModelData); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export interface ModelData {
  context_window: number;
  description: string;
  id: string;
  input: {
    image: boolean;
    text: boolean;
    pdf: boolean;
    video: boolean;
    audio: boolean;
  };
  max_tokens: number;
  name: string;
  object: string;
  output: {
    image: boolean;
    text: boolean;
    audio: boolean;
    video: boolean;
  };
  owned_by: string;
  pricing: {
    input?: string;
    output?: string;
    input_cache_read?: string;
    input_cache_write?: string;
    web_search?: string;
    image?: string;
  };
  reasoning: boolean;
  tags?: string[];
  /** Undefined means the catalog does not declare tool support. */
  toolCall: boolean | undefined;
  type: "language" | "embedding" | "image" | "video";
}
/* oxlint-enable import/no-named-export */
