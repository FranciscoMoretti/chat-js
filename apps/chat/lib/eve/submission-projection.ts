import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "@/lib/ai/types";
import { recordEveMessageReceipt } from "@/lib/db/queries";

const receipt = z
  .object({
    data: z
      .object({
        correlationIds: z.array(z.uuid()).optional(),
        kind: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .loose(),
    meta: z.object({ id: z.string() }).loose(),
    type: z.literal("message.received"),
  })
  .loose();
const deliveryMetadata = z.object({
  chatjs: z.object({
    operationId: z.uuid().optional(),
    selectedTool: frontendToolsSchema.nullable(),
  }),
});

const seededHistory = z.object({
  data: z.object({
    messages: z.array(
      z.object({
        id: z.string(),
        metadata: z.object({ custom: z.unknown().optional() }).optional(),
        role: z.string(),
      })
    ),
  }),
  type: z.literal("history.seeded"),
});
const restoredHistory = z.object({
  data: z.object({ events: z.array(z.unknown()) }),
  type: z.literal("history.restored"),
});

// Imported/forked history transfers display only. It must never acknowledge a new submission.
const importEveHistoryAnnotations = async (
  ownerId: string,
  sessionId: string,
  value: unknown
): Promise<void> => {
  const seed = seededHistory.safeParse(value);
  if (seed.success) {
    for (const message of seed.data.data.messages) {
      if (message.role === "user") {
        // oxlint-disable-next-line no-await-in-loop -- Process native history in order so first receipt identity and stream frame order remain stable.
        await recordEveMessageReceipt({
          imported: true,
          importedSelection:
            deliveryMetadata.safeParse(message.metadata?.custom).data?.chatjs
              .selectedTool ?? null,
          messageId: message.id,
          operationIds: [],
          ownerId,
          sessionId,
        });
      }
    }
  }
  const restored = restoredHistory.safeParse(value);
  if (restored.success) {
    for (const event of restored.data.data.events) {
      // oxlint-disable-next-line no-await-in-loop -- Process native history in order so first receipt identity and stream frame order remain stable.
      await importEveHistoryAnnotations(ownerId, sessionId, event);
      const prior = receipt.safeParse(event);
      if (prior.success && prior.data.data.kind === undefined) {
        // oxlint-disable-next-line no-await-in-loop -- Process native history in order so first receipt identity and stream frame order remain stable.
        await recordEveMessageReceipt({
          imported: true,
          importedSelection:
            deliveryMetadata.safeParse(prior.data.data.metadata).data?.chatjs
              .selectedTool ?? null,
          messageId: prior.data.meta.id,
          operationIds: [],
          ownerId,
          sessionId,
        });
      }
    }
  }
};

// Only server-read native events reach this module. Correlation is evidence, never authority.
const annotationForReceipt = async (
  ownerId: string,
  sessionId: string,
  value: unknown
): ReturnType<typeof recordEveMessageReceipt> => {
  await importEveHistoryAnnotations(ownerId, sessionId, value);
  const parsed = receipt.safeParse(value);
  if (!parsed.success || parsed.data.data.kind !== undefined) {
    return undefined;
  }
  const metadata = deliveryMetadata.safeParse(parsed.data.data.metadata).data
    ?.chatjs;
  const operationIds =
    parsed.data.data.correlationIds ??
    (metadata?.operationId === undefined ? [] : [metadata.operationId]);
  return await recordEveMessageReceipt({
    imported: false,
    importedSelection: metadata?.selectedTool ?? null,
    messageId: parsed.data.meta.id,
    operationIds,
    ownerId,
    sessionId,
  });
};

const projectEveSubmissionEvents = async (
  ownerId: string,
  sessionId: string,
  events: readonly MessageStreamEvent[]
): Promise<MessageStreamEvent[]> => {
  const projected: MessageStreamEvent[] = [];
  for (const event of events) {
    // oxlint-disable-next-line no-await-in-loop -- Process native history in order so first receipt identity and stream frame order remain stable.
    const annotation = await annotationForReceipt(ownerId, sessionId, event);
    projected.push(
      event.type === "message.received" && annotation !== undefined
        ? {
            ...event,
            data: {
              ...event.data,
              metadata: {
                ...event.data.metadata,
                chatjs: {
                  ...deliveryMetadata.safeParse(event.data.metadata).data
                    ?.chatjs,
                  ...(annotation.source === "submission"
                    ? { operationIds: annotation.operationIds }
                    : {}),
                  selectedTool: frontendToolsSchema
                    .nullable()
                    .parse(annotation.selectedTool),
                  sessionId,
                },
              },
            },
          }
        : event
    );
  }
  return projected;
};

// Preserve every native frame and cursor, including lease controls. Only receipt metadata changes.
const projectEveSubmissionStream = (
  ownerId: string,
  sessionId: string,
  body: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> => {
  let pending = "";
  const projectLine = async (line: string): Promise<string> => {
    if (line.trim() === "") {
      return line;
    }
    const value: unknown = JSON.parse(line);
    await importEveHistoryAnnotations(ownerId, sessionId, value);
    const parsed = receipt.safeParse(value);
    if (!parsed.success) {
      return line;
    }
    const annotation = await annotationForReceipt(
      ownerId,
      sessionId,
      parsed.data
    );
    if (annotation === undefined) {
      return line;
    }
    return JSON.stringify({
      ...parsed.data,
      data: {
        ...parsed.data.data,
        metadata: {
          ...parsed.data.data.metadata,
          chatjs: {
            ...deliveryMetadata.safeParse(parsed.data.data.metadata).data
              ?.chatjs,
            ...(annotation.source === "submission"
              ? { operationIds: annotation.operationIds }
              : {}),
            selectedTool: frontendToolsSchema
              .nullable()
              .parse(annotation.selectedTool),
            sessionId,
          },
        },
      },
    });
  };
  const decoder = new TextDecoder();
  return body
    .pipeThrough(
      new TransformStream<Uint8Array, string>({
        flush(controller) {
          controller.enqueue(decoder.decode());
        },
        transform(chunk, controller) {
          controller.enqueue(decoder.decode(chunk, { stream: true }));
        },
      })
    )
    .pipeThrough(
      new TransformStream<string, string>({
        async flush(controller) {
          if (pending !== "") {
            controller.enqueue(await projectLine(pending));
          }
        },
        async transform(chunk, controller) {
          pending += chunk;
          let newline = pending.indexOf("\n");
          while (newline !== -1) {
            const line = pending.slice(0, newline);
            pending = pending.slice(newline + 1);
            // oxlint-disable-next-line no-await-in-loop -- Process native history in order so first receipt identity and stream frame order remain stable.
            controller.enqueue(`${await projectLine(line)}\n`);
            newline = pending.indexOf("\n");
          }
        },
      })
    )
    .pipeThrough(new TextEncoderStream());
};

export { projectEveSubmissionEvents, projectEveSubmissionStream };
