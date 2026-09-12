import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
} from "ai";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import type { createClient } from "redis";
import { createResumableStreamContext } from "resumable-stream";
import type { ResumableStreamContext } from "resumable-stream";
import throttle from "throttleit";

import { getAppModelDefinition } from "@/lib/ai/app-models";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { determineExplicitlyRequestedTools } from "@/lib/ai/determine-explicitly-requested-tools";
import { ChatSDKError } from "@/lib/ai/errors";
import {
  generateFollowupSuggestions,
  streamFollowupSuggestions,
} from "@/lib/ai/followup-suggestions";
import { systemPrompt } from "@/lib/ai/prompts";
import { getStreamErrorMessage } from "@/lib/ai/stream-errors";
import { calculateMessagesTokens } from "@/lib/ai/token-utils";
import {
  getPrimarySelectedModelId,
  isSelectedModelValue,
} from "@/lib/ai/types";
import type { ChatMessage, ToolName } from "@/lib/ai/types";
import {
  getAnonymousSession,
  setAnonymousSession,
} from "@/lib/anonymous-session-server";
import { createAssistantRequestMessageId } from "@/lib/assistant-request-id";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { createAnonymousSession } from "@/lib/create-anonymous-session";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { canSpend, deductCredits } from "@/lib/db/credits";
import { getMcpConnectorsByUserId } from "@/lib/db/mcp-queries";
import {
  cancelActiveMessage,
  getChatById,
  getMessageById,
  getMessageCanceledAt,
  getProjectById,
  getUserById,
  isGenerationCancellationRequested,
  saveChatIfNotExists,
  saveMessageIfNotExists,
  updateMessage,
  updateMessageActiveStreamId,
} from "@/lib/db/queries";
import type { McpConnector } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { MAX_INPUT_TOKENS } from "@/lib/limits/tokens";
import { createModuleLogger } from "@/lib/logger";
import { connectRedisClients } from "@/lib/redis/client";
import type { AnonymousSession } from "@/lib/types/anonymous";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { generateUUID } from "@/lib/utils";
import { checkAnonymousRateLimit, getClientIP } from "@/lib/utils/rate-limit";

import { generateTitleFromUserMessage } from "../../actions";
import { getThreadUpToMessageId } from "./get-thread-up-to-message-id";

// Optional Redis must not prevent the chat route from loading.
const redisLog = createModuleLogger("redis");
const redisClients = await connectRedisClients(env, () =>
  redisLog.error("Redis connection error")
);
const redisPublisher = redisClients?.publisher ?? null;
const redisSubscriber = redisClients?.subscriber ?? null;

let globalStreamContext: ResumableStreamContext | null = null;

export const getStreamContext = (): ResumableStreamContext | null => {
  if (globalStreamContext) {
    return globalStreamContext;
  }

  // Resumable streams require Redis - return null if not configured
  if (!(redisPublisher && redisSubscriber)) {
    return null;
  }

  globalStreamContext = createResumableStreamContext({
    keyPrefix: `${config.appPrefix}:resumable-stream`,
    publisher: redisPublisher,
    subscriber: redisSubscriber,
    waitUntil: after,
  });

  return globalStreamContext;
};

type AnonymousSessionResult =
  | { success: true; session: AnonymousSession }
  | { success: false; error: Response };

const handleAnonymousSession = async ({
  request,
  redis,
  selectedModelId,
}: {
  request: NextRequest;
  redis: ReturnType<typeof createClient> | null;
  selectedModelId: AppModelId;
}): Promise<AnonymousSessionResult> => {
  const log = createModuleLogger("api:chat:anonymous");

  const clientIP = getClientIP(request);
  const rateLimitResult = await checkAnonymousRateLimit(clientIP, redis);

  if (!rateLimitResult.success) {
    log.warn({ clientIP }, "Rate limit exceeded");
    return {
      error: Response.json(
        { error: rateLimitResult.error, type: "RATE_LIMIT_EXCEEDED" },
        { headers: rateLimitResult.headers || {}, status: 429 }
      ),
      success: false,
    };
  }

  const session =
    (await getAnonymousSession()) ?? (await createAnonymousSession());

  if (session.remainingCredits <= 0) {
    log.info("Anonymous credit limit reached");
    return {
      error: Response.json(
        {
          error: "You've used your free credits. Sign up to continue chatting!",
          suggestion:
            "Create an account to get more credits and access to more AI models",
          type: "ANONYMOUS_LIMIT_EXCEEDED",
        },
        { headers: rateLimitResult.headers || {}, status: 402 }
      ),
      success: false,
    };
  }

  if (
    !(ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]).includes(
      selectedModelId
    )
  ) {
    log.warn("Model not available for anonymous users");
    return {
      error: Response.json(
        {
          availableModels: ANONYMOUS_LIMITS.AVAILABLE_MODELS,
          error: "Model not available for anonymous users",
        },
        { headers: rateLimitResult.headers || {}, status: 403 }
      ),
      success: false,
    };
  }

  return { session, success: true };
};

const handleChatValidation = async ({
  chatId,
  userId,
  userMessage,
  projectId,
}: {
  chatId: string;
  userId: string;
  userMessage: ChatMessage;
  projectId?: string;
}): Promise<{ error: Response | null; isNewChat: boolean }> => {
  const log = createModuleLogger("api:chat:validation");

  const chat = await getChatById({ id: chatId });
  let isNewChat = false;

  if (chat) {
    if (chat.userId !== userId) {
      log.warn(
        {
          chatId,
          chatUserId: chat.userId,
          userId,
        },
        "Unauthorized - chat ownership mismatch"
      );
      return {
        error: new Response("Unauthorized", { status: 401 }),
        isNewChat,
      };
    }
  } else {
    isNewChat = true;
    const title = await generateTitleFromUserMessage({
      message: userMessage,
    });

    await saveChatIfNotExists({ id: chatId, projectId, title, userId });
  }

  const [existentMessage] = await getMessageById({ id: userMessage.id });

  if (existentMessage && existentMessage.chatId !== chatId) {
    log.warn(
      {
        chatId,
        existentMessageChatId: existentMessage.chatId,
        userMessageId: userMessage.id,
      },
      "Unauthorized - message chatId mismatch"
    );
    return { error: new Response("Unauthorized", { status: 401 }), isNewChat };
  }

  await saveMessageIfNotExists({
    chatId,
    id: userMessage.id,
    message: userMessage,
  });

  return { error: null, isNewChat };
};

const resolveSelectedModelId = ({
  requestSelectedModelId,
  selectedModel,
}: {
  requestSelectedModelId?: AppModelId;
  selectedModel: ChatMessage["metadata"]["selectedModel"];
}): AppModelId | null => {
  if (typeof selectedModel === "string") {
    return requestSelectedModelId ?? selectedModel;
  }

  if (requestSelectedModelId) {
    if (!selectedModel || typeof selectedModel !== "object") {
      return null;
    }
    const requestedCount = selectedModel[requestSelectedModelId];
    return requestedCount && requestedCount > 0 ? requestSelectedModelId : null;
  }

  return getPrimarySelectedModelId(selectedModel);
};

const checkUserCanSpend = async (userId: string): Promise<Response | null> => {
  const userCanSpend = await canSpend(userId);
  if (!userCanSpend) {
    return new Response("Insufficient credits", { status: 402 });
  }
  return null;
};

const handleUserValidationAndCredits = async ({
  chatId,
  userId,
  userMessage,
  projectId,
}: {
  chatId: string;
  userId: string;
  userMessage: ChatMessage;
  projectId?: string;
}): Promise<{ error: Response } | { isNewChat: boolean }> => {
  const validationResult = await handleChatValidation({
    chatId,
    projectId,
    userId,
    userMessage,
  });
  if (validationResult.error) {
    return { error: validationResult.error };
  }

  const creditError = await checkUserCanSpend(userId);
  if (creditError) {
    return { error: creditError };
  }

  return { isNewChat: validationResult.isNewChat };
};

const getSystemPrompt = async ({
  isAnonymous,
  chatId,
}: {
  isAnonymous: boolean;
  chatId: string;
}): Promise<string> => {
  let system = systemPrompt();
  if (!isAnonymous) {
    const currentChat = await getChatById({ id: chatId });
    if (currentChat?.projectId) {
      const project = await getProjectById({ id: currentChat.projectId });
      if (project?.instructions) {
        system = `${system}\n\nProject instructions:\n${project.instructions}`;
      }
    }
  }
  return system;
};

const finalizeMessageAndCredits = async ({
  messages,
  userId,
  isAnonymous,
  chatId,
  costAccumulator,
  selectedModelId,
  parallelGroupId,
  parallelIndex,
  isPrimaryParallel,
}: {
  messages: ChatMessage[];
  userId: string | null;
  isAnonymous: boolean;
  chatId: string;
  costAccumulator: CostAccumulator;
  selectedModelId: AppModelId;
  parallelGroupId: string | null;
  parallelIndex: number | null;
  isPrimaryParallel: boolean | null;
}): Promise<void> => {
  const log = createModuleLogger("api:chat:finalize");
  let messageSaved = true;

  try {
    const assistantMessage = messages.at(-1);

    if (!assistantMessage) {
      throw new Error("No assistant message found!");
    }

    if (!isAnonymous) {
      messageSaved = await updateMessage({
        chatId,
        id: assistantMessage.id,
        message: {
          ...assistantMessage,
          metadata: {
            ...assistantMessage.metadata,
            activeStreamId: null,
            isPrimaryParallel:
              isPrimaryParallel ??
              assistantMessage.metadata.isPrimaryParallel ??
              null,
            parallelGroupId:
              parallelGroupId ??
              assistantMessage.metadata.parallelGroupId ??
              null,
            parallelIndex:
              parallelIndex ?? assistantMessage.metadata.parallelIndex ?? null,
            selectedModel: selectedModelId,
          },
        },
      });
      if (!messageSaved) {
        log.info(
          { messageId: assistantMessage.id },
          "Skipped finalizing canceled message"
        );
        return;
      }
    }

    const totalCost = await costAccumulator.getTotalCost();
    const entries = costAccumulator.getEntries();

    log.info({ entries }, "Cost accumulator entries");
    log.info({ totalCost }, "Cost accumulator total cost");

    if (userId && !isAnonymous && messageSaved) {
      await deductCredits(userId, totalCost);
    }
  } catch (error) {
    log.error({ error }, "Failed to save chat or finalize credits");
  }
};

const createChatStream = async ({
  messageId,
  chatId,
  userMessage,
  previousMessages,
  selectedModelId,
  parallelGroupId,
  parallelIndex,
  isPrimaryParallel,
  explicitlyRequestedTools,
  userId,
  abortController,
  isAnonymous,
  timeoutId,
  mcpConnectors,
  streamId,
  onChunk,
}: {
  messageId: string;
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  parallelGroupId: string | null;
  parallelIndex: number | null;
  isPrimaryParallel: boolean | null;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  abortController: AbortController;
  isAnonymous: boolean;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
  streamId: string;
  onChunk?: () => void;
}) => {
  const log = createModuleLogger("api:chat:stream");
  const system = await getSystemPrompt({ chatId, isAnonymous });

  // Create cost accumulator to track all LLM and API costs
  const costAccumulator = new CostAccumulator();

  // Build the data stream that will emit tokens
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      if (!isAnonymous) {
        const canceledAt = await getMessageCanceledAt({ messageId });
        const cancellationRequested =
          !!userId &&
          (await isGenerationCancellationRequested({
            chatId,
            messageId,
            userId,
          }));
        if (canceledAt || cancellationRequested) {
          abortController.abort();
          return;
        }
      }

      // Release provisional parallel responses only after this exact user
      // message has been persisted by the primary request.
      if (userId && isPrimaryParallel !== false) {
        dataStream.write({
          data: {
            chatId,
            parallelGroupId,
            userMessageId: userMessage.id,
          },
          id: generateUUID(),
          transient: true,
          type: "data-userMessagePersisted",
        });
      }

      const { result, contextForLLM } = await createCoreChatAgent({
        abortSignal: abortController.signal,
        costAccumulator,
        dataStream,
        explicitlyRequestedTools,
        isAnonymous,
        mcpConnectors,
        messageId,
        onChunk,
        onError: (error) => {
          log.error({ error }, "streamText error");
        },
        previousMessages,
        selectedModelId,
        system,
        userId,
        userMessage,
      });

      const initialMetadata: ChatMessage["metadata"] = {
        activeStreamId: isAnonymous ? null : streamId,
        createdAt: new Date(),
        isPrimaryParallel,
        parallelGroupId,
        parallelIndex,
        parentMessageId: userMessage.id,
        selectedModel: selectedModelId,
      };

      dataStream.merge(
        result.toUIMessageStream({
          messageMetadata: ({ part }) => {
            // send custom information to the client on start:
            if (part.type === "start") {
              return initialMetadata;
            }

            // when the message is finished, send additional information:
            if (part.type === "finish") {
              // Add main stream LLM usage to accumulator
              if (part.totalUsage) {
                costAccumulator.addLLMCost(
                  selectedModelId,
                  part.totalUsage,
                  "main-chat"
                );
              }
              return {
                ...initialMetadata,
                activeStreamId: null,
                usage: part.totalUsage,
              };
            }
          },
          sendReasoning: true,
        })
      );
      await result.consumeStream();

      const responseMessages = await result.responseMessages;

      // Generate and stream follow-up suggestions
      if (config.ai.tools.followupSuggestions.enabled) {
        const followupSuggestionsResult = generateFollowupSuggestions([
          ...contextForLLM,
          ...responseMessages,
        ]);
        await streamFollowupSuggestions({
          followupSuggestionsResult,
          writer: dataStream,
        });
      }
    },
    generateId: () => messageId,
    onError: (error) => {
      clearTimeout(timeoutId);
      // If the stream fails, ensure the placeholder assistant message is no longer marked resumable.
      // Otherwise the client will try to resume a stream that no longer exists and we end up with a
      // stuck partial placeholder on reload.
      if (!isAnonymous) {
        after(() => {
          const update = updateMessageActiveStreamId({
            activeStreamId: null,
            id: messageId,
          });
          return (async () => {
            try {
              await update;
            } catch (dbError) {
              log.error(
                { error: dbError },
                "Failed to clear activeStreamId on stream error"
              );
            }
          })();
        });
      }

      log.error({ error }, "onError");
      return getStreamErrorMessage(error);
    },
    onFinish: async ({ messages }) => {
      clearTimeout(timeoutId);
      await finalizeMessageAndCredits({
        chatId,
        costAccumulator,
        isAnonymous,
        isPrimaryParallel,
        messages,
        parallelGroupId,
        parallelIndex,
        selectedModelId,
        userId,
      });
    },
  });

  return stream;
};

const emptyChatStreamResponse = () => {
  const stream = createUIMessageStream<ChatMessage>({
    execute: () => {
      // This stream intentionally emits no messages.
    },
  });

  return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
};

const executeChatRequest = async ({
  chatId,
  userMessage,
  previousMessages,
  requestId,
  selectedModelId,
  parallelGroupId,
  parallelIndex,
  isPrimaryParallel,
  explicitlyRequestedTools,
  userId,
  isAnonymous,
  abortController,
  timeoutId,
  mcpConnectors,
}: {
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  requestId: string | undefined;
  selectedModelId: AppModelId;
  parallelGroupId: string | null;
  parallelIndex: number | null;
  isPrimaryParallel: boolean | null;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  isAnonymous: boolean;
  abortController: AbortController;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
}): Promise<Response> => {
  const log = createModuleLogger("api:chat:execute");
  const messageId = requestId
    ? createAssistantRequestMessageId({
        chatId,
        parallelGroupId,
        parallelIndex,
        requestId,
        selectedModelId,
        userMessageId: userMessage.id,
      })
    : generateUUID();
  const streamId = generateUUID();

  if (
    !isAnonymous &&
    userId &&
    (await isGenerationCancellationRequested({ chatId, messageId, userId }))
  ) {
    clearTimeout(timeoutId);
    return emptyChatStreamResponse();
  }

  if (!isAnonymous) {
    // The first provisional request can replay before its persistence acknowledgment arrives, so
    // placeholder creation must be idempotent.
    const insertedMessage = await saveMessageIfNotExists({
      chatId,
      id: messageId,
      message: {
        id: messageId,
        metadata: {
          activeStreamId: streamId,
          createdAt: new Date(),
          isPrimaryParallel,
          parallelGroupId,
          parallelIndex,
          parentMessageId: userMessage.id,
          selectedModel: selectedModelId,
          selectedTool: undefined,
        },
        parts: [],
        role: "assistant",
      },
    });

    if (!insertedMessage) {
      clearTimeout(timeoutId);
      return emptyChatStreamResponse();
    }

    if (
      userId &&
      (await isGenerationCancellationRequested({ chatId, messageId, userId }))
    ) {
      await cancelActiveMessage({
        canceledAt: new Date(),
        chatId,
        messageId,
      });
      clearTimeout(timeoutId);
      return emptyChatStreamResponse();
    }
  }

  // Create throttled cancel check (max once per second) for authenticated users
  const onChunk =
    !isAnonymous && userId
      ? throttle(async () => {
          const canceledAt = await getMessageCanceledAt({ messageId });
          if (canceledAt) {
            abortController.abort();
          }
        }, 1000)
      : undefined;

  // Build the data stream that will emit tokens
  const stream = await createChatStream({
    abortController,
    chatId,
    explicitlyRequestedTools,
    isAnonymous,
    isPrimaryParallel,
    mcpConnectors,
    messageId,
    onChunk,
    parallelGroupId,
    parallelIndex,
    previousMessages,
    selectedModelId,
    streamId,
    timeoutId,
    userId,
    userMessage,
  });

  const publisher = redisPublisher;
  if (publisher) {
    after(async () => {
      try {
        const keyPattern = `${config.appPrefix}:resumable-stream:rs:sentinel:${streamId}*`;
        const keys = await publisher.keys(keyPattern);
        if (keys.length > 0) {
          await Promise.all(
            keys.map((key: string) => publisher.expire(key, 300))
          );
        }
      } catch (error) {
        log.error({ error }, "Failed to set TTL on stream keys");
      }
    });
  }

  const sseHeaders = {
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
  } as const;

  const streamContext = getStreamContext();
  const sseStream = () => stream.pipeThrough(new JsonToSseTransformStream());

  if (streamContext) {
    log.debug("Returning resumable stream");
    return new Response(
      await streamContext.resumableStream(streamId, sseStream),
      { headers: sseHeaders }
    );
  }

  return new Response(sseStream(), { headers: sseHeaders });
};

type SessionSetupResult =
  | { success: false; error: Response }
  | {
      success: true;
      userId: string | null;
      isAnonymous: boolean;
      anonymousSession: AnonymousSession | null;
      modelDefinition: AppModelDefinition;
    };

const validateAndSetupSession = async ({
  request,
  selectedModelId,
}: {
  request: NextRequest;
  selectedModelId: AppModelId;
}): Promise<SessionSetupResult> => {
  const log = createModuleLogger("api:chat:setup");

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;
  const isAnonymous = userId === null;

  let anonymousSession: AnonymousSession | null = null;

  if (userId) {
    const user = await getUserById({ userId });
    if (!user) {
      log.warn("User not found");
      return {
        error: new Response("User not found", { status: 404 }),
        success: false,
      };
    }
  } else {
    const result = await handleAnonymousSession({
      redis: redisPublisher,
      request,
      selectedModelId,
    });

    if (!result.success) {
      return result;
    }
    anonymousSession = result.session;
  }

  let modelDefinition: AppModelDefinition;
  try {
    modelDefinition = await getAppModelDefinition(selectedModelId);
  } catch {
    log.warn("Model not found");
    return {
      error: new Response("Model not found", { status: 404 }),
      success: false,
    };
  }

  return {
    anonymousSession,
    isAnonymous,
    modelDefinition,
    success: true,
    userId,
  };
};

const prepareRequestContext = async ({
  userMessage,
  chatId,
  isAnonymous,
  anonymousPreviousMessages,
}: {
  userMessage: ChatMessage;
  chatId: string;
  isAnonymous: boolean;
  anonymousPreviousMessages: ChatMessage[];
}): Promise<{
  previousMessages: ChatMessage[];
  error: Response | null;
}> => {
  const log = createModuleLogger("api:chat:prepare");

  // Validate input token limit (50k tokens for user message)
  const totalTokens = calculateMessagesTokens(
    await convertToModelMessages([userMessage])
  );

  if (totalTokens > MAX_INPUT_TOKENS) {
    log.warn({ MAX_INPUT_TOKENS, totalTokens }, "Token limit exceeded");
    const error = new ChatSDKError(
      "input_too_long:chat",
      `Message too long: ${totalTokens} tokens (max: ${MAX_INPUT_TOKENS})`
    );
    return {
      error: error.toResponse(),
      previousMessages: [],
    };
  }

  const messageThreadToParent = isAnonymous
    ? anonymousPreviousMessages
    : await getThreadUpToMessageId(
        chatId,
        userMessage.metadata.parentMessageId
      );

  const previousMessages = messageThreadToParent.slice(-5);

  return { error: null, previousMessages };
};

interface ChatPostBody {
  id: string;
  isPrimaryParallel?: boolean | null;
  message: ChatMessage;
  parallelGroupId?: string | null;
  parallelIndex?: number | null;
  prevMessages: ChatMessage[];
  projectId?: string;
  requestId?: string;
  selectedModelId?: AppModelId;
}

type ChatPostBodyResult =
  | { success: false; error: Response }
  | { success: true; body: ChatPostBody };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const parseMessageDate = (value: unknown): Date | null => {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeChatMessage = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { metadata } = value;

  if (
    typeof value.id !== "string" ||
    !Array.isArray(value.parts) ||
    typeof value.role !== "string" ||
    !isRecord(metadata) ||
    !isSelectedModelValue(metadata.selectedModel)
  ) {
    return null;
  }

  const createdAt = parseMessageDate(metadata.createdAt);
  if (!createdAt) {
    return null;
  }

  const { parentMessageId } = metadata;
  const { activeStreamId } = metadata;

  const hasValidParentMessageId =
    parentMessageId === null || typeof parentMessageId === "string";
  const hasValidActiveStreamId =
    activeStreamId === null || typeof activeStreamId === "string";

  if (!(hasValidParentMessageId && hasValidActiveStreamId)) {
    return null;
  }

  return {
    ...(value as ChatMessage),
    metadata: {
      ...(metadata as ChatMessage["metadata"]),
      activeStreamId,
      createdAt,
      parentMessageId,
      selectedModel: metadata.selectedModel,
    },
  };
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const optionalNullableString = (value: unknown): string | null | undefined => {
  if (value === null || typeof value === "string") {
    return value;
  }
  return undefined;
};

const optionalNullableInteger = (value: unknown): number | null | undefined => {
  if (value === null) {
    return null;
  }
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
};

const optionalNullableBoolean = (
  value: unknown
): boolean | null | undefined => {
  if (value === null || typeof value === "boolean") {
    return value;
  }
  return undefined;
};

const readChatPostBody = async (
  request: NextRequest
): Promise<ChatPostBodyResult> => {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return {
      error: new ChatSDKError("bad_request:api").toResponse(),
      success: false,
    };
  }

  if (!isRecord(rawBody)) {
    return {
      error: new ChatSDKError("bad_request:api").toResponse(),
      success: false,
    };
  }

  const userMessage = normalizeChatMessage(rawBody.message);
  const anonymousPreviousMessages = Array.isArray(rawBody.prevMessages)
    ? rawBody.prevMessages.map(normalizeChatMessage)
    : null;

  if (
    typeof rawBody.id !== "string" ||
    !userMessage ||
    userMessage.role !== "user" ||
    !anonymousPreviousMessages ||
    anonymousPreviousMessages.some((message) => !message)
  ) {
    return {
      error: new ChatSDKError("bad_request:api").toResponse(),
      success: false,
    };
  }

  return {
    body: {
      id: rawBody.id,
      isPrimaryParallel: optionalNullableBoolean(rawBody.isPrimaryParallel),
      message: userMessage,
      parallelGroupId: optionalNullableString(rawBody.parallelGroupId),
      parallelIndex: optionalNullableInteger(rawBody.parallelIndex),
      prevMessages: anonymousPreviousMessages as ChatMessage[],
      projectId: optionalString(rawBody.projectId),
      requestId: optionalString(rawBody.requestId),
      selectedModelId: optionalString(rawBody.selectedModelId) as
        | AppModelId
        | undefined,
    },
    success: true,
  };
};

const prepareChatPersistenceAndCredits = async ({
  chatId,
  projectId,
  userId,
  userMessage,
}: {
  chatId: string;
  projectId?: string;
  userId: string | null;
  userMessage: ChatMessage;
}): Promise<{ error: Response } | { isNewChat: boolean }> => {
  if (userId) {
    return await handleUserValidationAndCredits({
      chatId,
      projectId,
      userId,
      userMessage,
    });
  }

  return { isNewChat: false };
};

const consumeAnonymousCreditBeforeStream = async (
  anonymousSession: AnonymousSession | null
): Promise<void> => {
  if (!anonymousSession) {
    return;
  }

  // Cookies must be updated before streaming starts, but only after request
  // context validation has succeeded.
  await setAnonymousSession({
    ...anonymousSession,
    remainingCredits: anonymousSession.remainingCredits - 1,
  });
};

const prepareChatExecutionInputs = async ({
  anonymousPreviousMessages,
  chatId,
  isAnonymous,
  userId,
  userMessage,
}: {
  anonymousPreviousMessages: ChatMessage[];
  chatId: string;
  isAnonymous: boolean;
  userId: string | null;
  userMessage: ChatMessage;
}): Promise<
  | { error: Response }
  | { mcpConnectors: McpConnector[]; previousMessages: ChatMessage[] }
> => {
  const [contextResult, mcpConnectors] = await Promise.all([
    prepareRequestContext({
      anonymousPreviousMessages,
      chatId,
      isAnonymous,
      userMessage,
    }),
    config.ai.tools.mcp.enabled && userId && !isAnonymous
      ? getMcpConnectorsByUserId({ userId })
      : Promise.resolve([]),
  ]);

  if (contextResult.error) {
    return { error: contextResult.error };
  }

  return {
    mcpConnectors,
    previousMessages: contextResult.previousMessages,
  };
};

export const POST = async (request: NextRequest) => {
  const log = createModuleLogger("api:chat");
  try {
    const bodyResult = await readChatPostBody(request);

    if (!bodyResult.success) {
      log.warn("No user message found");
      return bodyResult.error;
    }

    const {
      id: chatId,
      message: userMessage,
      prevMessages: anonymousPreviousMessages,
      projectId,
      requestId,
      selectedModelId: requestSelectedModelId,
      parallelGroupId,
      parallelIndex,
      isPrimaryParallel,
    } = bodyResult.body;

    const selectedModelId = resolveSelectedModelId({
      requestSelectedModelId,
      selectedModel: userMessage.metadata.selectedModel,
    });
    const responseParallelGroupId =
      parallelGroupId === undefined
        ? (userMessage.metadata.parallelGroupId ?? null)
        : parallelGroupId;

    if (!selectedModelId) {
      log.warn("No selectedModel in user message metadata");
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const sessionSetup = await validateAndSetupSession({
      request,
      selectedModelId,
    });

    if (!sessionSetup.success) {
      return sessionSetup.error;
    }

    const { userId, isAnonymous, anonymousSession } = sessionSetup;
    const persistenceResult = await prepareChatPersistenceAndCredits({
      chatId,
      projectId,
      userId,
      userMessage,
    });

    if ("error" in persistenceResult) {
      return persistenceResult.error;
    }

    const executionInputs = await prepareChatExecutionInputs({
      anonymousPreviousMessages,
      chatId,
      isAnonymous,
      userId,
      userMessage,
    });

    if ("error" in executionInputs) {
      return executionInputs.error;
    }

    await consumeAnonymousCreditBeforeStream(anonymousSession);

    const explicitlyRequestedTools = determineExplicitlyRequestedTools(
      userMessage.metadata.selectedTool ?? null
    );

    // Create AbortController with timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 290_000);

    return await executeChatRequest({
      abortController,
      chatId,
      explicitlyRequestedTools,
      isAnonymous,
      isPrimaryParallel: isPrimaryParallel ?? null,
      mcpConnectors: executionInputs.mcpConnectors,
      parallelGroupId: responseParallelGroupId,
      parallelIndex: parallelIndex ?? null,
      previousMessages: executionInputs.previousMessages,
      requestId,
      selectedModelId,
      timeoutId,
      userId,
      userMessage,
    });
  } catch (error) {
    log.error(
      {
        err:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      },
      "RESPONSE > POST /api/chat error"
    );
    return new Response("Internal Server Error", {
      status: 500,
    });
  }
};
