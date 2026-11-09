"use client";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode, ComponentProps } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChatModelsContext } from "../../../chat/providers/chat-models-provider";
import { DefaultModelContext } from "../../../chat/providers/default-model-provider";
import { DeletionContext } from "../../../chat/components/eve/eve-deletion-provider";
import { EveDeleteDialogView } from "../../../chat/components/eve/eve-delete-dialog";
import { ToolAvailabilityContext } from "../../../chat/components/composer/tool-availability";
import { usePreviewFixtures } from "./preview-plugins";
import { useTRPC } from "../../../chat/trpc/context";
import type { AppModelDefinition } from "../../../chat/lib/ai/app-models";

const models: AppModelDefinition[] = [
  {
    id: "openai/gpt-5-nano",
    apiModelId: "openai/gpt-5-nano",
    name: "GPT-5 nano",
    owned_by: "openai",
    reasoning: false,
  },
  {
    id: "anthropic/claude-sonnet-4",
    apiModelId: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    owned_by: "anthropic",
    reasoning: true,
  },
].map((model) => ({
  ...model,
  type: "language",
  object: "model",
  description: "Sample model for local preview",
  context_window: 128_000,
  max_tokens: 8192,
  pricing: {},
  input: { text: true, image: true, pdf: true, audio: false, video: false },
  output: { text: true, image: false, audio: false, video: false },
  toolCall: true,
}));
const catalog = {
  allModels: models,
  models,
  getModelById: (id: string) => models.find((model) => model.id === id),
};

export const PreviewRuntime = ({
  children,
  tools,
  aiTitles,
  onDeleted,
}: {
  readonly children: ReactNode;
  readonly tools: ReadonlySet<string>;
  readonly aiTitles: boolean;
  readonly onDeleted: () => void;
}) => {
  const [model, setModel] = useState(models[0].id);
  const [deleting, setDeleting] =
    useState<
      Parameters<
        NonNullable<ComponentProps<typeof DeletionContext>["value"]>
      >[0]
    >();
  const fixtures = usePreviewFixtures();
  const cache = useQueryClient();
  const trpc = useTRPC();
  useEffect(() => {
    if (fixtures.setGeneratedTitles(aiTitles)) {
      void Promise.all([
        cache.invalidateQueries({ queryKey: trpc.eve.get.pathKey() }),
        cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
        cache.invalidateQueries({ queryKey: trpc.search.query.pathKey() }),
      ]);
    }
  }, [aiTitles, cache, fixtures, trpc]);
  const selection = useMemo(
    () => ({
      defaultModel: model,
      changeModel: (id: string) => {
        setModel(id);
      },
    }),
    [model]
  );
  return (
    <ChatModelsContext value={catalog}>
      <DefaultModelContext value={selection}>
        <ToolAvailabilityContext value={tools}>
          <DeletionContext value={setDeleting}>
            {children}
            {deleting && (
              <EveDeleteDialogView
                title={deleting.title}
                scope={deleting.scope}
                phase="confirm"
                onClose={() => {
                  setDeleting(undefined);
                }}
                onCheck={() => {
                  /* The local deletion finishes synchronously. */
                }}
                onDelete={() => {
                  try {
                    fixtures.deleteConversation();
                    void cache.invalidateQueries({
                      queryKey: trpc.eve.list.pathKey(),
                    });
                    setDeleting(undefined);
                    onDeleted();
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Sample deletion failed"
                    );
                  }
                }}
              />
            )}
          </DeletionContext>
        </ToolAvailabilityContext>
      </DefaultModelContext>
    </ChatModelsContext>
  );
};
