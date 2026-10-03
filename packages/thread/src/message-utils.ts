import type { UIMessage } from "ai";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const getMessageText = (message: UIMessage): string =>
  message.parts
    .map((part): string => (part.type === "text" ? part.text : ""))
    .join("");
/* oxlint-enable typescript/prefer-readonly-parameter-types */
