import type { MessageStreamEvent } from "eve/client";

/** SDK fields this reader does not inspect remain optional and opaque. */
type IgnoredSdkFields<Value> = Value extends object
  ? { readonly [Key in keyof Value]?: unknown }
  : unknown;

type ModelReferenceEvent = IgnoredSdkFields<MessageStreamEvent> &
  (
    | {
        readonly type: "step.started";
        readonly data: {
          readonly turnId: string;
          readonly modelId: string;
        } & IgnoredSdkFields<
          Extract<MessageStreamEvent, { type: "step.started" }>["data"]
        >;
      }
    | {
        readonly type: Exclude<MessageStreamEvent["type"], "step.started">;
      }
  );

/** First native model reference per turn, from the current session.
 * @param {readonly MessageStreamEvent[]} events Native stream events whose steps carry model provenance.
 * @returns {Map<string, string>} The first recorded model reference for each native turn.
 */
const responseModelReferences = (
  events: readonly ModelReferenceEvent[]
): Map<string, string> => {
  const models = new Map<string, string>();
  for (const event of events) {
    if (event.type === "step.started" && !models.has(event.data.turnId)) {
      models.set(event.data.turnId, event.data.modelId);
    }
  }
  return models;
};

/** Native responses require runtime evidence; imported responses retain provenance.
 * @param {readonly MessageStreamEvent[]} events Native stream evidence used to resolve the turn's model reference.
 * @param {string} turnId Native turn identity, or an empty identity for an imported response.
 * @param {string | undefined} importedModelId Original model reference retained by an imported response.
 * @returns {string} The provider model ID after removing its gateway prefix.
 */
const responseModel = (
  events: readonly ModelReferenceEvent[],
  turnId: string,
  importedModelId?: string
): string => {
  const reference = turnId
    ? responseModelReferences(events).get(turnId)
    : importedModelId;
  const separator = (reference ?? "").indexOf("/");
  if (
    typeof reference === "string" &&
    reference !== "" &&
    separator > 0 &&
    separator < reference.length - 1
  ) {
    return reference.slice(separator + 1);
  }
  throw new Error(
    "The response model is unavailable. Reload before regenerating."
  );
};
export { responseModel, responseModelReferences };
