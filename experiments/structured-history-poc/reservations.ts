import { capturedHistory } from "./history-adapter";

// Synthetic accepted server-side reservations, standing in for ChatJS's existing DB capture.
// The real app retains owner/revision checks, file membership and dispatch fencing there.
const original: Parameters<typeof capturedHistory>[0] = {
  messages: [
    {
      role: "user" as const,
      parts: [
        { type: "text" as const, text: "Review the document" },
        {
          type: "file" as const,
          url: "https://files.invalid/owner/doc",
          mediaType: "text/plain",
          filename: "doc.txt",
        },
      ],
    },
    {
      role: "assistant" as const,
      parts: [
        { type: "reasoning" as const, text: "Read and summarize" },
        {
          type: "dynamic-tool" as const,
          toolName: "historical-read",
          input: { path: "doc.txt" },
          state: "output-available" as const,
          output: { value: 42 },
        },
        { type: "text" as const, text: "The value is 42" },
        { type: "step-start" as const },
        {
          type: "dynamic-tool" as const,
          toolName: "historical-write",
          input: {},
          state: "output-denied" as const,
          reason: "Not authorized",
        },
        {
          type: "dynamic-tool" as const,
          toolName: "historical-error",
          input: {},
          state: "output-error" as const,
          errorText: "Unavailable",
        },
      ],
    },
  ],
};
const snapshot = capturedHistory(original, [
  "captured-user",
  "captured-assistant",
]);
// Demonstrate the stored intent does not follow a mutable source object.
for (const message of original.messages) {
  for (const part of message.parts) {
    if (part.type === "dynamic-tool" && part.state === "output-available") {
      part.output = { value: 999 };
    }
  }
}
original.messages.splice(0);
export const reservation = (owner: string, operation: string) => {
  if (owner !== "poc-owner" || operation !== "accepted-copy") {
    throw new Error("Reservation not owned by caller.");
  }
  return structuredClone(snapshot);
};
