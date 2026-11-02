# Typed chat messages over Eve

`ChatMessage` in `apps/chat/lib/ai/chat-message.ts` is the application display contract. Its installed tool input/output types come from `InstalledTools`, which infers the registered Eve tool definitions. It preserves Eve's message metadata, authorization parts, tool metadata, approvals and lifecycle states.

```tsx
import type { ChatMessage } from "@/lib/ai/chat-message";

type WordCountPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-wordCount" }
>;

function WordCount({ part }: { part: WordCountPart }) {
  if (part.state !== "output-available" || part.partial) {
    return null;
  }
  return <span>{part.output.words} words</span>;
}
```

The logical chat store projects native observer messages through `projectChatMessages`. Shared and guest transcripts enter the same projection through `EveMessages`. The projection caches immutable inputs, so repeated observations do not replace message references or trigger publication loops.

Known tool parts use `type: "tool-<name>"`. Their successful ChatJS receipts are unwrapped; error receipts become `output-error` and retain progress updates. Streaming input is partial, error input remains unknown, and preliminary output retains `partial: true`. Output availability alone does not mean final completion.

Unknown tools, including MCP and removed tools, retain `dynamic-tool` and unknown payloads. Imported text outputs and unsupported receipt versions also remain native. A generic fallback therefore stays representable alongside known tools.

## Trust boundary

There is one explicit assertion in `project-chat-messages.ts`. After checking membership in the installed tool catalog and converting the receipt, it trusts the authored tool payload contract, matching the pre-Eve shared `UIMessage` approach. This is not runtime validation of every tool-specific payload: malformed or historical JSON can still disagree with the current tool definition. Existing schema-validated renderers continue rejecting such data. A custom renderer can use `ToolRendererProps<"tool-name">` from `lib/ai/tool-renderer-registry` directly when it accepts that trust model.

Keep custom execution registrations, installed tool names and renderer keys in agreement. Tool types are imported with `import type`; the browser projection does not import server executors.

## Native boundaries

Eve events, persistence, replay, sharing sanitization and command semantics remain native. Each enriched part retains its original `native` reference. Use `nativeMessage` or `nativeMessagePart` when passing the display view to a native integration; this restores the original receipt, including usage and error evidence. Never persist the unwrapped display view in place of Eve history.
