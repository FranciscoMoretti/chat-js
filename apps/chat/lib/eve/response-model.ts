import { isNonEmptyString } from "@/lib/is-non-empty-string";
import type { ReadonlyEveMessageMetadata } from "./readonly-message-types";
import type { SessionStreamEvent } from "eve/client";
import { activeTurn } from "eve/events";
import type { SessionView } from "eve/events";

const responseModelReferences = (
  events: readonly SessionStreamEvent[]
): Map<string, string> => {
  const models = new Map<string, string>();
  for (const event of events) {
    if (
      event.type === "model.started" &&
      event.scope?.turnId !== undefined &&
      !models.has(event.scope.turnId)
    ) {
      models.set(event.scope.turnId, event.data.modelId);
    }
  }
  return models;
};

type ResponseMetadata =
  | Readonly<Pick<ReadonlyEveMessageMetadata, "turnId" | "modelId">>
  | undefined;

/** Live replies use the recorded turn. Copied replies can carry their original ID directly. */
const recordedResponseModel = (
  models: ReadonlyMap<string, string>,
  metadata: ResponseMetadata
): string | undefined =>
  isNonEmptyString(metadata?.turnId)
    ? models.get(metadata.turnId)
    : metadata?.modelId;

const selectableResponseModel = (
  models: ReadonlyMap<string, string>,
  metadata: ResponseMetadata
): string | undefined => {
  const reference = recordedResponseModel(models, metadata);
  const separator = reference?.indexOf("/") ?? -1;
  return reference !== undefined &&
    separator > 0 &&
    separator < reference.length - 1
    ? reference
    : undefined;
};

const responseModel = (
  events: readonly SessionStreamEvent[],
  metadata: ResponseMetadata
): string => {
  const reference = selectableResponseModel(
    responseModelReferences(events),
    metadata
  );
  if (reference === undefined) {
    throw new Error(
      "The response model is unavailable. Reload before regenerating."
    );
  }
  return reference;
};

const activeResponseModel = (
  view: SessionView,
  models: ReadonlyMap<string, string>
): string | undefined => {
  const active = activeTurn(view);
  return active === undefined ? undefined : models.get(active.turnId);
};

export {
  activeResponseModel,
  recordedResponseModel,
  selectableResponseModel,
  responseModel,
  responseModelReferences,
};
