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
import { previewModels } from "./preview-data";
import { usePreviewFixtures } from "./preview-plugins";
import { useTRPC } from "../../../chat/trpc/context";
import type { AppModelDefinition } from "../../../chat/lib/ai/app-models";

const modelCatalog = (entries: AppModelDefinition[]) => ({
  allModels: entries,
  models: entries,
  getModelById: (id: string) => entries.find((model) => model.id === id),
});
const catalog = modelCatalog(previewModels);

export const guestPreviewCatalog = (id: string) =>
  modelCatalog([{ ...previewModels[0], id, apiModelId: id }]);

export const PreviewModelPreference = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [model, setModel] = useState(previewModels[0].id);
  const selection = useMemo(
    () => ({ defaultModel: model, changeModel: setModel }),
    [model]
  );
  return (
    <DefaultModelContext value={selection}>{children}</DefaultModelContext>
  );
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
  return (
    <ChatModelsContext value={catalog}>
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
    </ChatModelsContext>
  );
};
