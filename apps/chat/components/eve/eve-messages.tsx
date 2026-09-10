"use client";

import type {
  EveMessage,
  EveMessageInputRequest,
  EveMessagePart,
  InputResponse,
} from "eve/client";
import { Copy, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { noteInput, noteOutput } from "@/lib/eve/contracts";
import { EveAttachment } from "./eve-attachment";
import { EveToolResult } from "./eve-tool-result";

function PendingInput({
  request,
  disabled,
  respond,
  prompt,
}: {
  request: EveMessageInputRequest;
  disabled: boolean;
  respond: (response: InputResponse) => void;
  prompt?: string;
}) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <p>{prompt ?? request.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {request.options?.map((option) => (
          <Button
            disabled={disabled}
            key={option.id}
            onClick={() =>
              respond({ requestId: request.requestId, optionId: option.id })
            }
            type="button"
            variant={option.style === "danger" ? "outline" : "default"}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {request.allowFreeform && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) {
              respond({ requestId: request.requestId, text: text.trim() });
            }
          }}
        >
          <Textarea
            aria-label="Your answer"
            disabled={disabled}
            maxLength={16_000}
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
          <Button disabled={disabled || !text.trim()} type="submit">
            Submit answer
          </Button>
        </form>
      )}
    </div>
  );
}

function toolStatus(
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>,
  confirmed: boolean
) {
  if (confirmed) {
    return "Note confirmed.";
  }
  if (part.state === "approval-requested") {
    return "Waiting for input.";
  }
  if (part.state === "output-denied") {
    return "Request declined.";
  }
  if (part.state === "output-error") {
    return part.errorText;
  }
  if (part.state === "output-available") {
    return "Tool completed.";
  }
  return "Working…";
}

function Part({
  messageId,
  part,
  disabled,
  respond,
}: {
  messageId: string;
  part: EveMessagePart;
  disabled: boolean;
  respond: (response: InputResponse) => void;
}) {
  if (part.type === "text") {
    return <Response>{part.text}</Response>;
  }
  if (part.type === "file") {
    return <EveAttachment part={part} />;
  }
  if (part.type === "reasoning") {
    return (
      <ReasoningPart
        content={part.text}
        isLoading={part.state === "streaming"}
      />
    );
  }
  if (part.type === "step-start") {
    return null;
  }
  if (part.type !== "dynamic-tool") {
    return <p>Unsupported content in this conversation.</p>;
  }
  if (
    part.state === "output-available" &&
    ["wordCount", "getWeather", "retrieveUrl"].includes(part.toolName)
  ) {
    return <EveToolResult messageId={messageId} part={part} />;
  }
  const request = part.toolMetadata?.eve?.inputRequest;
  const input = noteInput.safeParse(part.input);
  const output =
    part.state === "output-available"
      ? noteOutput.safeParse(part.output)
      : null;
  return (
    <section
      aria-label="Tool result"
      className="space-y-3 rounded-lg border p-4"
    >
      <p className="font-medium">
        {part.toolName === "confirm_note" ? "Confirm note" : "Agent request"}
      </p>
      {input.success && <p>{input.data.note}</p>}
      {part.state === "approval-requested" && request ? (
        <PendingInput
          disabled={disabled}
          key={request.requestId}
          prompt={
            part.toolName === "confirm_note" ? "Confirm this note?" : undefined
          }
          request={request}
          respond={respond}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {toolStatus(part, output?.success === true)}
        </p>
      )}
    </section>
  );
}
export function EveMessages({
  messages,
  disabled,
  respond,
  onEdit,
  onRegenerate,
  actionsDisabled = disabled,
}: {
  messages: readonly EveMessage[];
  actionsDisabled?: boolean;
  onEdit?: (message: EveMessage) => void;
  onRegenerate?: (message: EveMessage) => void;
  disabled: boolean;
  respond: (response: InputResponse) => void;
}) {
  return messages.map((message) => (
    <Message className="flex-col" from={message.role} key={message.id}>
      <MessageContent>
        <span className="sr-only">
          {message.role === "user" ? "You" : "Assistant"}
        </span>
        {message.parts.map((part, index) => (
          <Part
            disabled={disabled}
            // Eve message parts are append-only; their index is their stable identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: Eve parts have no IDs and retain their order during streaming.
            key={`${message.id}:${index}`}
            messageId={message.id}
            part={part}
            respond={respond}
          />
        ))}
      </MessageContent>
      <MessageActions className={message.role === "user" ? "justify-end" : ""}>
        {message.role === "user" && onEdit && (
          <MessageAction
            disabled={
              actionsDisabled ||
              !message.metadata?.turnId ||
              !!message.metadata.optimistic
            }
            onClick={() => onEdit(message)}
            tooltip="Edit message"
          >
            <Pencil size={14} />
          </MessageAction>
        )}
        {message.role === "assistant" && onRegenerate && (
          <MessageAction
            disabled={actionsDisabled || !message.metadata?.turnId}
            onClick={() => {
              const userMessage = messages
                .slice(0, messages.indexOf(message))
                .findLast((item) => item.role === "user");
              if (userMessage) {
                onRegenerate(userMessage);
              }
            }}
            tooltip="Regenerate response"
          >
            <RotateCcw size={14} />
          </MessageAction>
        )}
        <MessageAction
          onClick={async () => {
            const text = message.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n");
            try {
              await navigator.clipboard.writeText(text);
              toast.success("Copied to clipboard!");
            } catch {
              toast.error("Unable to copy this message.");
            }
          }}
          tooltip="Copy"
        >
          <Copy size={14} />
        </MessageAction>
      </MessageActions>
    </Message>
  ));
}
