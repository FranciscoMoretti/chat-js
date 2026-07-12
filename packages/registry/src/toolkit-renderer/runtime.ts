import type { Experimental_VideoModelV3 } from "@ai-sdk/provider";
import type { FilePart, ImageModel, LanguageModel, Tool, ToolSet } from "ai";

export type ToolNeed =
  | "env.read"
  | "files.attachments"
  | "files.previous"
  | "media.write"
  | "models.image"
  | "models.language"
  | "models.video"
  | "url.retrieve";

export type ModelSelection = {
  model?: string;
  purpose?: string;
};

export type VideoModel = Experimental_VideoModelV3;

export type StoredMedia = {
  filename: string;
  mediaType: string;
  size?: number;
  url: string;
};

export type MediaWriteInput = {
  bytes: Uint8Array;
  filename?: string;
  mediaType: string;
};

export type CostUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type ImageGenerationModel =
  | {
      model: ImageModel;
      modelId: string;
      type: "image";
    }
  | {
      model: LanguageModel;
      modelId: string;
      type: "language";
    };

export type ToolRuntimeContext = {
  capabilities: ReadonlySet<ToolNeed>;
  env: {
    get(name: string): string | undefined;
    require(name: string): string;
  };
  files: {
    attachments(input?: { mediaTypes?: string[] }): Promise<FilePart[]>;
    previous(input?: {
      kind?: "image" | "video";
      limit?: number;
    }): Promise<FilePart[]>;
  };
  media: {
    write(input: MediaWriteInput): Promise<StoredMedia>;
  };
  models: {
    image(input?: ModelSelection): Promise<ImageModel>;
    imageGeneration(input?: ModelSelection): Promise<ImageGenerationModel>;
    language(input?: ModelSelection): Promise<LanguageModel>;
    video(input?: ModelSelection): Promise<VideoModel>;
  };
  cost: {
    addAPICost(apiName: string, cost: number): void;
    addLLMCost(modelId: string, usage: CostUsage, source: string): void;
  };
};

export type RegistryToolDefinition<TTool extends Tool = Tool> = {
  createTool(ctx: ToolRuntimeContext): TTool;
  id: string;
  isEnabled?: () => boolean;
  needs?: readonly ToolNeed[];
};

export type RegistryToolEntry = Tool | RegistryToolDefinition;

export type InferRegistryTool<TEntry> =
  TEntry extends RegistryToolDefinition<infer TTool>
    ? TTool
    : TEntry extends Tool
      ? TEntry
      : never;

export function defineTool<TDefinition extends RegistryToolDefinition>(
  definition: TDefinition
): TDefinition {
  return definition;
}

function isRegistryToolDefinition(
  entry: RegistryToolEntry
): entry is RegistryToolDefinition {
  return typeof (entry as RegistryToolDefinition).createTool === "function";
}

function isToolEnabled(entry: RegistryToolEntry): boolean {
  return (entry as { isEnabled?: () => boolean }).isEnabled?.() ?? true;
}

function hasNeeds(
  needs: readonly ToolNeed[] | undefined,
  capabilities: ReadonlySet<ToolNeed>
): boolean {
  return needs?.every((need) => capabilities.has(need)) ?? true;
}

export function createRegistryTools<
  TEntries extends Record<string, RegistryToolEntry>,
>(entries: TEntries, ctx: ToolRuntimeContext): ToolSet {
  const tools: ToolSet = {};

  for (const [name, entry] of Object.entries(entries)) {
    if (!isToolEnabled(entry)) {
      continue;
    }

    if (isRegistryToolDefinition(entry)) {
      if (!hasNeeds(entry.needs, ctx.capabilities)) {
        continue;
      }
      tools[name] = entry.createTool(ctx);
      continue;
    }

    tools[name] = entry;
  }

  return tools;
}
