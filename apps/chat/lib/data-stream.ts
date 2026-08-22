import { type DataUIPart, isDataUIPart } from "ai";
import equal from "fast-deep-equal";
import type { ChatMessage, CustomUIDataTypes } from "@/lib/ai/types";

export function isDataPartOnMessagePath(
  dataPart: DataUIPart<CustomUIDataTypes>,
  messages: ChatMessage[]
): boolean {
  return messages.some((message) =>
    message.parts.some((part) => {
      if (!(isDataUIPart(part) && part.type === dataPart.type)) {
        return false;
      }

      if (part.id !== undefined || dataPart.id !== undefined) {
        return part.id === dataPart.id;
      }

      return equal(part.data, dataPart.data);
    })
  );
}
