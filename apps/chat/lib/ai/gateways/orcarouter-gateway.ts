import { createAnthropic } from "@ai-sdk/anthropic";
import type { Experimental_VideoModelV3 } from "@ai-sdk/provider";
import type { ImageModel, LanguageModel } from "ai";
import { createModuleLogger } from "@/lib/logger";
import type { AiGatewayModel } from "../ai-gateway-models-schemas";
import { getFallbackModels } from "./fallback-models";
import type { GatewayProvider } from "./gateway-provider";

const log = createModuleLogger("ai/gateways/orcarouter");

interface OrcaRouterModelResponse {
  architecture: {
    input_modalities?: string[];
    output_modalities?: string[];
  } | null;
  context_length: number | null;
  created: number;
  description?: string;
  id: string;
  name?: string;
  object: string;
  owned_by: string;
  pricing: {
    prompt?: string;
    completion?: string;
  } | null;
  top_provider: {
    max_completion_tokens: number | null;
  } | null;
}

function deriveTags(model: OrcaRouterModelResponse): string[] {
  // orcarouter/* meta-models omit `architecture` — they surface only the
  // endpoints they support (`supported_endpoint_types`), not modalities.
  const inputMods = model.architecture?.input_modalities ?? ["text"];
  const outputMods = model.architecture?.output_modalities ?? ["text"];

  const tags: string[] = [];
  if (inputMods.includes("image")) {
    tags.push("vision");
  }
  if (inputMods.includes("file")) {
    tags.push("file-input");
  }
  if (outputMods.includes("image")) {
    tags.push("image-generation");
  }
  return tags;
}

function toAiGatewayModel(model: OrcaRouterModelResponse): AiGatewayModel {
  const tags = deriveTags(model);
  const outputMods = model.architecture?.output_modalities ?? ["text"];

  let type: "language" | "embedding" | "image" = "language";
  if (!outputMods.includes("text") && outputMods.includes("image")) {
    type = "image";
  }

  const owned_by = model.id.split("/")[0] ?? "orcarouter";

  return {
    id: model.id,
    object: "model",
    created: model.created ?? 0,
    owned_by,
    name: model.name ?? model.id,
    description: model.description ?? "",
    context_window: model.context_length ?? 0,
    max_tokens: model.top_provider?.max_completion_tokens ?? 0,
    type,
    tags: tags.length > 0 ? (tags as AiGatewayModel["tags"]) : undefined,
    pricing: {
      input: model.pricing?.prompt,
      output: model.pricing?.completion,
    },
  };
}

export class OrcaRouterGateway implements GatewayProvider<
  "orcarouter",
  string,
  never,
  never
> {
  readonly type = "orcarouter" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("ORCAROUTER_API_KEY is not configured");
    }
    return createAnthropic({
      apiKey,
      // OrcaRouter serves the Anthropic Messages API on the same endpoint.
      baseURL: "https://api.orcarouter.ai",
    });
  }

  createLanguageModel(modelId: string): LanguageModel {
    const provider = this.getProvider();
    return provider.chat(modelId);
  }

  createImageModel(_modelId: never): ImageModel | null {
    // OrcaRouter routes image generation through multimodal language models.
    // Return null to signal callers should use createLanguageModel instead.
    return null;
  }

  createVideoModel(_modelId: never): Experimental_VideoModelV3 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return process.env.ORCAROUTER_API_KEY;
  }

  private getModelsUrl(): string {
    return "https://api.orcarouter.ai/v1/models";
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      log.warn("No ORCAROUTER_API_KEY found, using fallback models");
      return [...getFallbackModels(this.type)];
    }

    const url = this.getModelsUrl();
    log.debug({ url }, "Fetching models from OrcaRouter");

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        log.error(
          { status: response.status, statusText: response.statusText, url },
          "OrcaRouter returned non-OK response",
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const body = await response.json();
      const models = (body.data ?? []) as OrcaRouterModelResponse[];
      const result = models.map(toAiGatewayModel);

      log.info(
        { modelCount: result.length },
        "Successfully fetched models from OrcaRouter",
      );
      return result;
    } catch (error) {
      log.error(
        { err: error, url },
        "Error fetching models from OrcaRouter, falling back to generated models",
      );
      return [...getFallbackModels(this.type)];
    }
  }
}
