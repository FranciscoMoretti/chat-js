import type { z } from "zod";
import type { createConversationInput, conversationBinding } from "./contracts";
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { CreationScope } from "./creation-storage";

export type SingleCreation = z.output<typeof createConversationInput>;
export type SelectedCreation =
  | SingleCreation
  | (Omit<SingleCreation, "modelId" | "forkKind"> & {
      modelIds: string[];
      forkKind?: "edit" | "comparison";
    });
export type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface CreationHandler {
  parse: (input: unknown) => SelectedCreation;
  prepare: (
    input: ReadonlyNativeSurface<
      Omit<SingleCreation, "message" | "modelId">
    > & { readonly message: ReadonlyEveMessageInput },
    modelIds: readonly string[],
    saved?: SelectedCreation
  ) => SelectedCreation;
  resolve: (
    storage: StorageAccess,
    ownerId: string,
    operation: ReadonlyNativeSurface<SelectedCreation>,
    scope?: ReadonlyNativeSurface<CreationScope>
  ) => Promise<z.output<typeof conversationBinding>>;
}
