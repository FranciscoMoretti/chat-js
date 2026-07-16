import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
} from "ai";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "redis";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import throttle from "throttleit";
import {
  type AppModelDefinition,
  type AppModelId,
  getAppModelDefinition,
} from "@/lib/ai/app-models";
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
  type ChatMessage,
  getPrimarySelectedModelId,
  isSelectedModelValue,
  type ToolName,
} from "@/lib/ai/types";
import {
  getAnonymousSession,
  setAnonymousSession,
} from "@/lib/anonymous-session-server";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { createAnonymousSession } from "@/lib/create-anonymous-session";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { canSpend, deductCredits } from "@/lib/db/credits";
import { getMcpConnectorsByUserId } from "@/lib/db/mcp-queries";
import {
  getChatById,
  getMessageById,
  getMessageCanceledAt,
  getProjectById,
  getUserById,
  saveChatIfNotExists,
  saveMessageIfNotExists,
  updateMessage,
  updateMessageActiveStreamId,
} from "@/lib/db/queries";
import type { McpConnector } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { MAX_INPUT_TOKENS } from "@/lib/limits/tokens";
import { createModuleLogger } from "@/lib/logger";
import type { AnonymousSession } from "@/lib/types/anonymous";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { generateUUID } from "@/lib/utils";
import { checkAnonymousRateLimit, getClientIP } from "@/lib/utils/rate-limit";
import { generateTitleFromUserMessage } from "../../actions";
import { getThreadUpToMessageId } from "./get-thread-up-to-message-id";

// Shared Redis clients for resumable stream
let redisPublisher: ReturnType<typeof createClient> | null = null;
let redisSubscriber: ReturnType<typeof createClient> | null = null;

if (env.REDIS_URL) {
  redisPublisher = createClient({ url: env.REDIS_URL });
  redisSubscriber = createClient({ url: env.REDIS_URL });
  await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext(): ResumableStreamContext | null {
  if (globalStreamContext) {
    return globalStreamContext;
  }

  // Resumable streams require Redis - return null if not configured
  if (!(redisPublisher && redisSubscriber)) {
    return null;
  }

  globalStreamContext = createResumableStreamContext({
    waitUntil: after,
    keyPrefix: `${config.appPrefix}:resumable-stream`,
    publisher: redisPublisher,
    subscriber: redisSubscriber,
  });

  return globalStreamContext;
}

type AnonymousSessionResult =
  | { success: true; session: AnonymousSession }
  | { success: false; error: Response };

async function handleAnonymousSession({
  request,
  redis,
  selectedModelId,
}: {
  request: NextRequest;
  redis: ReturnType<typeof import("redis").createClient> | null;
  selectedModelId: AppModelId;
}): Promise<AnonymousSessionResult> {
  const log = createModuleLogger("api:chat:anonymous");

  const clientIP = getClientIP(request);
  const rateLimitResult = await checkAnonymousRateLimit(clientIP, redis);

  if (!rateLimitResult.success) {
    log.warn({ clientIP }, "Rate limit exceeded");
    return {
      success: false,
      error: Response.json(
        { error: rateLimitResult.error, type: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers: rateLimitResult.headers || {} }
      ),
    };
  }

  const session =
    (await getAnonymousSession()) ?? (await createAnonymousSession());

  if (session.remainingCredits <= 0) {
    log.info("Anonymous credit limit reached");
    return {
      success: false,
      error: Response.json(
        {
          error: "You've used your free credits. Sign up to continue chatting!",
          type: "ANONYMOUS_LIMIT_EXCEEDED",
          suggestion:
            "Create an account to get more credits and access to more AI models",
        },
        { status: 402, headers: rateLimitResult.headers || {} }
      ),
    };
  }

  if (
    !(ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]).includes(
      selectedModelId
    )
  ) {
    log.warn("Model not available for anonymous users");
    return {
      success: false,
      error: Response.json(
        {
          error: "Model not available for anonymous users",
          availableModels: ANONYMOUS_LIMITS.AVAILABLE_MODELS,
        },
        { status: 403, headers: rateLimitResult.headers || {} }
      ),
    };
  }

  return { success: true, session };
}

async function handleChatValidation({
  chatId,
  userId,
  userMessage,
  projectId,
}: {
  chatId: string;
  userId: string;
  userMessage: ChatMessage;
  projectId?: string;
}): Promise<{ error: Response | null; isNewChat: boolean }> {
  const log = createModuleLogger("api:chat:validation");

  const chat = await getChatById({ id: chatId });
  let isNewChat = false;

  if (chat) {
    if (chat.userId !== userId) {
      log.warn(
        {
          chatId,
          userId,
          chatUserId: chat.userId,
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

    await saveChatIfNotExists({ id: chatId, userId, title, projectId });
  }

  const [existentMessage] = await getMessageById({ id: userMessage.id });

  if (existentMessage && existentMessage.chatId !== chatId) {
    log.warn(
      {
        chatId,
        userMessageId: userMessage.id,
        existentMessageChatId: existentMessage.chatId,
      },
      "Unauthorized - message chatId mismatch"
    );
    return { error: new Response("Unauthorized", { status: 401 }), isNewChat };
  }

  await saveMessageIfNotExists({
    id: userMessage.id,
    chatId,
    message: userMessage,
  });

  return { error: null, isNewChat };
}

function resolveSelectedModelId({
  requestSelectedModelId,
  selectedModel,
}: {
  requestSelectedModelId?: AppModelId;
  selectedModel: ChatMessage["metadata"]["selectedModel"];
}): AppModelId | null {
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
}

async function checkUserCanSpend(userId: string): Promise<Response | null> {
  const userCanSpend = await canSpend(userId);
  if (!userCanSpend) {
    return new Response("Insufficient credits", { status: 402 });
  }
  return null;
}

async function handleUserValidationAndCredits({
  chatId,
  userId,
  userMessage,
  projectId,
}: {
  chatId: string;
  userId: string;
  userMessage: ChatMessage;
  projectId?: string;
}): Promise<{ error: Response } | { isNewChat: boolean }> {
  const validationResult = await handleChatValidation({
    chatId,
    userId,
    userMessage,
    projectId,
  });
  if (validationResult.error) {
    return { error: validationResult.error };
  }

  const creditError = await checkUserCanSpend(userId);
  if (creditError) {
    return { error: creditError };
  }

  return { isNewChat: validationResult.isNewChat };
}

async function getSystemPrompt({
  isAnonymous,
  chatId,
}: {
  isAnonymous: boolean;
  chatId: string;
}): Promise<string> {
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
}

async function createChatStream({
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
  isNewChat,
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
  isNewChat: boolean;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
  streamId: string;
  onChunk?: () => void;
}) {
  const log = createModuleLogger("api:chat:stream");
  const system = await getSystemPrompt({ isAnonymous, chatId });

  // Create cost accumulator to track all LLM and API costs
  const costAccumulator = new CostAccumulator();

  // Build the data stream that will emit tokens
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      // Release provisional parallel responses only after this exact user
      // message has been persisted by the primary request.
      if (isNewChat && userId && isPrimaryParallel !== false) {
        dataStream.write({
          id: generateUUID(),
          type: "data-userMessagePersisted",
          data: {
            chatId,
            parallelGroupId,
            userMessageId: userMessage.id,
          },
          transient: true,
        });
      }

      const { result, contextForLLM } = await createCoreChatAgent({
        system,
        userMessage,
        previousMessages,
        selectedModelId,
        explicitlyRequestedTools,
        userId,
        isAnonymous,
        abortSignal: abortController.signal,
        messageId,
        dataStream,
        onError: (error) => {
          log.error({ error }, "streamText error");
        },
        onChunk,
        mcpConnectors,
        costAccumulator,
      });

      const initialMetadata: ChatMessage["metadata"] = {
        createdAt: new Date(),
        parentMessageId: userMessage.id,
        parallelGroupId,
        parallelIndex,
        isPrimaryParallel,
        selectedModel: selectedModelId,
        activeStreamId: isAnonymous ? null : streamId,
      };

      dataStream.merge(
        result.toUIMessageStream({
          sendReasoning: true,
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
                usage: part.totalUsage,
                activeStreamId: null,
              };
            }
          },
        })
      );
      await result.consumeStream();

      const response = await result.response;
      const responseMessages = response.messages;

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
    onFinish: async ({ messages }) => {
      clearTimeout(timeoutId);
      await finalizeMessageAndCredits({
        messages,
        userId,
        isAnonymous,
        chatId,
        costAccumulator,
        selectedModelId,
        parallelGroupId,
        parallelIndex,
        isPrimaryParallel,
      });
    },
    onError: (error) => {
      clearTimeout(timeoutId);
      // If the stream fails, ensure the placeholder assistant message is no longer marked resumable.
      // Otherwise the client will try to resume a stream that no longer exists and we end up with a
      // stuck partial placeholder on reload.
      if (!isAnonymous) {
        after(() =>
          Promise.resolve(
            updateMessageActiveStreamId({
              id: messageId,
              activeStreamId: null,
            })
          ).catch((dbError) => {
            log.error(
              { error: dbError },
              "Failed to clear activeStreamId on stream error"
            );
          })
        );
      }

      log.error({ error }, "onError");
      return getStreamErrorMessage(error);
    },
  });

  return stream;
}

function emptyChatStreamResponse() {
  const stream = createUIMessageStream<ChatMessage>({
    execute: () => undefined,
  });

  return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function executeChatRequest({
  chatId,
  userMessage,
  previousMessages,
  selectedModelId,
  assistantMessageId,
  parallelGroupId,
  parallelIndex,
  isPrimaryParallel,
  explicitlyRequestedTools,
  userId,
  isAnonymous,
  isNewChat,
  abortController,
  timeoutId,
  mcpConnectors,
}: {
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  assistantMessageId?: string;
  parallelGroupId: string | null;
  parallelIndex: number | null;
  isPrimaryParallel: boolean | null;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  isAnonymous: boolean;
  isNewChat: boolean;
  abortController: AbortController;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
}): Promise<Response> {
  const log = createModuleLogger("api:chat:execute");
  const messageId = assistantMessageId ?? generateUUID();
  const streamId = generateUUID();

  if (!isAnonymous) {
    // The first provisional request can replay before its persistence acknowledgment arrives, so
    // placeholder creation must be idempotent.
    const insertedMessage = await saveMessageIfNotExists({
      id: messageId,
      chatId,
      message: {
        id: messageId,
        role: "assistant",
        parts: [],
        metadata: {
          createdAt: new Date(),
          parentMessageId: userMessage.id,
          parallelGroupId,
          parallelIndex,
          isPrimaryParallel,
          selectedModel: selectedModelId,
          selectedTool: undefined,
          activeStreamId: streamId,
        },
      },
    });

    if (!insertedMessage) {
      clearTimeout(timeoutId);
      return emptyChatStreamResponse();
    }

    await updateMessageActiveStreamId({
      id: messageId,
      activeStreamId: streamId,
    });
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
    isNewChat,
    timeoutId,
    mcpConnectors,
    streamId,
    onChunk,
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
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
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
}

type SessionSetupResult =
  | { success: false; error: Response }
  | {
      success: true;
      userId: string | null;
      isAnonymous: boolean;
      anonymousSession: AnonymousSession | null;
      modelDefinition: AppModelDefinition;
    };

async function validateAndSetupSession({
  request,
  selectedModelId,
}: {
  request: NextRequest;
  selectedModelId: AppModelId;
}): Promise<SessionSetupResult> {
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
        success: false,
        error: new Response("User not found", { status: 404 }),
      };
    }
  } else {
    const result = await handleAnonymousSession({
      request,
      redis: redisPublisher,
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
      success: false,
      error: new Response("Model not found", { status: 404 }),
    };
  }

  return {
    success: true,
    userId,
    isAnonymous,
    anonymousSession,
    modelDefinition,
  };
}

async function prepareRequestContext({
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
}> {
  const log = createModuleLogger("api:chat:prepare");

  // Validate input token limit (50k tokens for user message)
  const totalTokens = calculateMessagesTokens(
    await convertToModelMessages([userMessage])
  );

  if (totalTokens > MAX_INPUT_TOKENS) {
    log.warn({ totalTokens, MAX_INPUT_TOKENS }, "Token limit exceeded");
    const error = new ChatSDKError(
      "input_too_long:chat",
      `Message too long: ${totalTokens} tokens (max: ${MAX_INPUT_TOKENS})`
    );
    return {
      previousMessages: [],
      error: error.toResponse(),
    };
  }

  const messageThreadToParent = isAnonymous
    ? anonymousPreviousMessages
    : await getThreadUpToMessageId(
        chatId,
        userMessage.metadata.parentMessageId
      );

  const previousMessages = messageThreadToParent.slice(-5);

  return { previousMessages, error: null };
}

async function finalizeMessageAndCredits({
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
}): Promise<void> {
  const log = createModuleLogger("api:chat:finalize");

  try {
    const assistantMessage = messages.at(-1);

    if (!assistantMessage) {
      throw new Error("No assistant message found!");
    }

    if (!isAnonymous) {
      await updateMessage({
        id: assistantMessage.id,
        chatId,
        message: {
          ...assistantMessage,
          metadata: {
            ...assistantMessage.metadata,
            parallelGroupId:
              parallelGroupId ??
              assistantMessage.metadata.parallelGroupId ??
              null,
            parallelIndex:
              parallelIndex ?? assistantMessage.metadata.parallelIndex ?? null,
            isPrimaryParallel:
              isPrimaryParallel ??
              assistantMessage.metadata.isPrimaryParallel ??
              null,
            selectedModel: selectedModelId,
            activeStreamId: null,
          },
        },
      });
    }

    // Get total cost from accumulator (includes all LLM calls + external API costs)
    const totalCost = await costAccumulator.getTotalCost();
    const entries = costAccumulator.getEntries();

    log.info({ entries }, "Cost accumulator entries");
    log.info({ totalCost }, "Cost accumulator total cost");

    // Deduct credits for authenticated users
    if (userId && !isAnonymous) {
      await deductCredits(userId, totalCost);
    }

    // Note: Anonymous credits are pre-deducted before streaming starts (cookies can't be set after response begins)
  } catch (error) {
    log.error({ error }, "Failed to save chat or finalize credits");
  }
}

type ChatPostBody = {
  assistantMessageId?: string;
  id: string;
  isPrimaryParallel?: boolean | null;
  message: ChatMessage;
  parallelGroupId?: string | null;
  parallelIndex?: number | null;
  prevMessages: ChatMessage[];
  projectId?: string;
  selectedModelId?: AppModelId;
};

type ChatPostBodyResult =
  | { success: false; error: Response }
  | { success: true; body: ChatPostBody };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseMessageDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeChatMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const metadata = value.metadata;

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

  const parentMessageId = metadata.parentMessageId;
  const activeStreamId = metadata.activeStreamId;

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
      createdAt,
      parentMessageId,
      activeStreamId,
      selectedModel: metadata.selectedModel,
    },
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === null || typeof value === "string") {
    return value;
  }
  return undefined;
}

function optionalNullableInteger(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
}

function optionalNullableBoolean(value: unknown): boolean | null | undefined {
  if (value === null || typeof value === "boolean") {
    return value;
  }
  return undefined;
}

async function readChatPostBody(
  request: NextRequest
): Promise<ChatPostBodyResult> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return {
      success: false,
      error: new ChatSDKError("bad_request:api").toResponse(),
    };
  }

  if (!isRecord(rawBody)) {
    return {
      success: false,
      error: new ChatSDKError("bad_request:api").toResponse(),
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
      success: false,
      error: new ChatSDKError("bad_request:api").toResponse(),
    };
  }

  return {
    success: true,
    body: {
      assistantMessageId: optionalString(rawBody.assistantMessageId),
      id: rawBody.id,
      isPrimaryParallel: optionalNullableBoolean(rawBody.isPrimaryParallel),
      message: userMessage,
      parallelGroupId: optionalNullableString(rawBody.parallelGroupId),
      parallelIndex: optionalNullableInteger(rawBody.parallelIndex),
      prevMessages: anonymousPreviousMessages as ChatMessage[],
      projectId: optionalString(rawBody.projectId),
      selectedModelId: optionalString(rawBody.selectedModelId) as
        | AppModelId
        | undefined,
    },
  };
}

async function prepareChatPersistenceAndCredits({
  chatId,
  projectId,
  userId,
  userMessage,
}: {
  chatId: string;
  projectId?: string;
  userId: string | null;
  userMessage: ChatMessage;
}): Promise<{ error: Response } | { isNewChat: boolean }> {
  if (userId) {
    return await handleUserValidationAndCredits({
      chatId,
      userId,
      userMessage,
      projectId,
    });
  }

  return { isNewChat: false };
}

async function consumeAnonymousCreditBeforeStream(
  anonymousSession: AnonymousSession | null
) {
  if (!anonymousSession) {
    return;
  }

  // Cookies must be updated before streaming starts, but only after request
  // context validation has succeeded.
  await setAnonymousSession({
    ...anonymousSession,
    remainingCredits: anonymousSession.remainingCredits - 1,
  });
}

async function prepareChatExecutionInputs({
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
> {
  const [contextResult, mcpConnectors] = await Promise.all([
    prepareRequestContext({
      userMessage,
      chatId,
      isAnonymous,
      anonymousPreviousMessages,
    }),
    config.ai.tools.mcp.enabled && userId && !isAnonymous
      ? getMcpConnectorsByUserId({ userId })
      : Promise.resolve([]),
  ]);

  if (contextResult.error) {
    return { error: contextResult.error };
  }

  return {
    previousMessages: contextResult.previousMessages,
    mcpConnectors,
  };
}

export async function POST(request: NextRequest) {
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
      assistantMessageId,
      selectedModelId: requestSelectedModelId,
      parallelGroupId,
      parallelIndex,
      isPrimaryParallel,
    } = bodyResult.body;

    const selectedModelId = resolveSelectedModelId({
      requestSelectedModelId,
      selectedModel: userMessage.metadata.selectedModel,
    });

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
    }, 290_000); // 290 seconds

    return await executeChatRequest({
      chatId,
      userMessage,
      previousMessages: executionInputs.previousMessages,
      selectedModelId,
      assistantMessageId,
      parallelGroupId:
        parallelGroupId ?? userMessage.metadata.parallelGroupId ?? null,
      parallelIndex: parallelIndex ?? null,
      isPrimaryParallel: isPrimaryParallel ?? null,
      explicitlyRequestedTools,
      userId,
      isAnonymous,
      isNewChat: persistenceResult.isNewChat,
      abortController,
      timeoutId,
      mcpConnectors: executionInputs.mcpConnectors,
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
}
