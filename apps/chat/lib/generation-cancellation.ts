export type GenerationCancellationTarget =
  | {
      chatId: string;
      messageId: string;
      type: "request";
    }
  | {
      chatId: string;
      messageId: string;
      type: "message";
    };
