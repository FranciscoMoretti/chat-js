import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { Attachment, ChatMessage, ToolName } from "@/lib/ai/types";
import { isSelectedModelValue } from "@/lib/ai/types";
import { deleteFilesByUrls } from "@/lib/file-storage";
import { createModuleLogger } from "@/lib/logger";
import { chatMessageToDbMessage } from "@/lib/message-conversion";
import {
  mapDBPartsToUIParts,
  mapUIMessagePartsToDBParts,
} from "@/lib/utils/message-mapping";

import type { ArtifactKind } from "../artifacts/artifact-kind";
import { db } from "./client";
import {
  chat,
  document,
  generationCancellation,
  message,
  part,
  project,
  suggestion,
  user,
  userModelPreference,
  vote,
} from "./schema";
import type { DBMessage, Part, User, UserModelPreference } from "./schema";

const logger = createModuleLogger("db:queries");

const getMessagesWithAttachments = async () => {
  try {
    return await db.select({ attachments: message.attachments }).from(message);
  } catch (error) {
    console.error(
      "Failed to get messages with attachments from database",
      error
    );
    throw error;
  }
};

const getGeneratedImageParts = () => {
  const toolName: ToolName = "generateImage";
  return db
    .select({ tool_output: part.tool_output })
    .from(part)
    .where(eq(part.tool_name, toolName));
};

const getFilePartUrls = (args: { messageIds?: string[] } = {}) => {
  const { messageIds } = args;
  let conditions: SQL<unknown> | undefined = eq(part.type, "file");
  if (messageIds && messageIds.length > 0) {
    conditions = and(conditions, inArray(part.messageId, messageIds));
  }
  return db.select({ file_url: part.file_url }).from(part).where(conditions);
};

const collectMessageAttachmentUrls = (
  messages: { attachments: unknown }[]
): string[] => {
  const urls: string[] = [];
  for (const msg of messages) {
    if (msg.attachments && Array.isArray(msg.attachments)) {
      for (const attachment of msg.attachments as Attachment[]) {
        if (attachment.url) {
          urls.push(attachment.url);
        }
      }
    }
  }
  return urls;
};

const collectFilePartUrls = (
  fileParts: { file_url: string | null }[]
): string[] => {
  const urls: string[] = [];
  for (const p of fileParts) {
    if (p.file_url) {
      urls.push(p.file_url);
    }
  }
  return urls;
};

const deleteAttachmentsFromMessages = async (messages: DBMessage[]) => {
  try {
    const attachmentUrls = collectMessageAttachmentUrls(messages);

    // Collect file URLs from Part table for these messages via shared helper
    const messageIds = messages.map((msg) => msg.id);
    if (messageIds.length > 0) {
      const fileParts = await getFilePartUrls({ messageIds });
      attachmentUrls.push(...collectFilePartUrls(fileParts));
    }

    // Deduplicate in case the same file URL is referenced multiple times
    const uniqueUrls = [...new Set(attachmentUrls)];
    if (uniqueUrls.length > 0) {
      await deleteFilesByUrls(uniqueUrls);
    }
  } catch (error) {
    console.error("Failed to delete stored attachments:", error);
    // Don't throw here - we still want to proceed with message deletion
    // even if blob cleanup fails
  }
};

const updateChatUpdatedAt = async ({ chatId }: { chatId: string }) => {
  try {
    return await db
      .update(chat)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat updatedAt by id from database");
    throw error;
  }
};

const _getUserByEmail = async (email: string): Promise<User[]> => {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error("Failed to get user from database");
    throw error;
  }
};

export const saveChat = async ({
  id,
  userId,
  title,
  projectId,
}: {
  id: string;
  userId: string;
  title: string;
  projectId?: string;
}) => {
  try {
    return await db.insert(chat).values({
      createdAt: new Date(),
      id,
      projectId: projectId ?? null,
      title,
      updatedAt: new Date(),
      userId,
    });
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
};

export const saveChatIfNotExists = async ({
  id,
  userId,
  title,
  projectId,
}: {
  id: string;
  userId: string;
  title: string;
  projectId?: string;
}) => {
  try {
    return await db
      .insert(chat)
      .values({
        createdAt: new Date(),
        id,
        projectId: projectId ?? null,
        title,
        updatedAt: new Date(),
        userId,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
};

export const deleteChatById = async ({ id }: { id: string }) => {
  try {
    // Get all messages for this chat to clean up their attachments
    const messagesToDelete = await db
      .select()
      .from(message)
      .where(eq(message.chatId, id));

    // Clean up attachments before deleting the chat (which will cascade delete messages)
    if (messagesToDelete.length > 0) {
      await deleteAttachmentsFromMessages(messagesToDelete);
    }

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
};

export const getChatsByUserId = async ({
  id,
  projectId,
}: {
  id: string;
  projectId?: string | null;
}) => {
  console.log("[getChatsByUserId] Starting", {
    projectId,
    projectIdIsNull: projectId === null,
    projectIdIsUndefined: projectId === undefined,
    projectIdType: typeof projectId,
    userId: id,
  });

  try {
    let conditions: SQL<unknown> | undefined = eq(chat.userId, id);
    if (projectId === null) {
      // Filter for chats without a project
      conditions = and(eq(chat.userId, id), isNull(chat.projectId));
      console.log("[getChatsByUserId] Using null project condition");
    } else if (projectId) {
      // Filter for chats in a specific project
      conditions = and(eq(chat.userId, id), eq(chat.projectId, projectId));
      console.log("[getChatsByUserId] Using specific project condition", {
        projectId,
      });
    } else {
      // Get all chats for user
      conditions = eq(chat.userId, id);
      console.log("[getChatsByUserId] Using all chats condition");
    }

    console.log("[getChatsByUserId] Executing query");
    const result = await db
      .select()
      .from(chat)
      .where(conditions)
      .orderBy(desc(chat.updatedAt));

    console.log("[getChatsByUserId] Query completed", {
      count: result.length,
      sampleChat: result[0]
        ? {
            id: result[0].id,
            updatedAt: result[0].updatedAt,
            updatedAtType: typeof result[0].updatedAt,
          }
        : null,
    });

    return result;
  } catch (error) {
    console.error(
      "[getChatsByUserId] Failed to get chats by user from database",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        projectId,
        userId: id,
      }
    );
    throw error;
  }
};

export const createProject = async ({
  id,
  userId,
  name,
  instructions = "",
  icon,
  iconColor,
}: {
  id: string;
  userId: string;
  name: string;
  instructions?: string;
  icon?: string;
  iconColor?: string;
}) => {
  try {
    return await db.insert(project).values({
      createdAt: new Date(),
      ...(icon && { icon }),
      ...(iconColor && { iconColor }),
      id,
      instructions,
      name,
      updatedAt: new Date(),
      userId,
    });
  } catch (error) {
    console.error("Failed to create project in database");
    throw error;
  }
};

export const getProjectsByUserId = async ({ userId }: { userId: string }) => {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));
  } catch (error) {
    console.error("Failed to get projects by user from database");
    throw error;
  }
};

export const getProjectById = async ({ id }: { id: string }) => {
  try {
    const [selectedProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, id));
    return selectedProject;
  } catch (error) {
    console.error("Failed to get project by id from database");
    throw error;
  }
};

export const updateProject = async ({
  id,
  updates,
}: {
  id: string;
  updates: Partial<{
    name: string;
    instructions: string;
    icon: string;
    iconColor: string;
  }>;
}) => {
  try {
    return await db
      .update(project)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(project.id, id));
  } catch (error) {
    console.error("Failed to update project in database");
    throw error;
  }
};

export const deleteProject = async ({ id }: { id: string }) => {
  try {
    return await db.delete(project).where(eq(project.id, id));
  } catch (error) {
    console.error("Failed to delete project from database");
    throw error;
  }
};

const _getChatsByProjectId = async ({ projectId }: { projectId: string }) => {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.projectId, projectId))
      .orderBy(desc(chat.updatedAt));
  } catch (error) {
    console.error("Failed to get chats by project id from database");
    throw error;
  }
};

const _moveChatToProject = async ({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId: string | null;
}) => {
  try {
    return await db.update(chat).set({ projectId }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to move chat to project in database");
    throw error;
  }
};

const _tryGetChatById = async ({ id }: { id: string }) => {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch {
    return null;
  }
};

export const getChatById = async ({ id }: { id: string }) => {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
};

export const saveMessage = async ({
  id,
  chatId,
  message: chatMessage,
}: {
  id: string;
  chatId: string;
  message: ChatMessage;
}) => {
  try {
    return await db.transaction(async (tx) => {
      // Convert ChatMessage to DBMessage (without parts)
      const dbMessage = chatMessageToDbMessage(chatMessage, chatId);
      dbMessage.id = id;

      // Insert message (without parts - parts are stored in Part table)
      await tx.insert(message).values(dbMessage);

      // Save parts to Part table
      const mappedDBParts = mapUIMessagePartsToDBParts(chatMessage.parts, id);
      if (mappedDBParts.length > 0) {
        await tx.insert(part).values(mappedDBParts);
      }

      // Update chat's updatedAt timestamp
      await updateChatUpdatedAt({ chatId });
    });
  } catch (error) {
    logger.error({ chatId, error, id }, "saveMessage failed");
    throw error;
  }
};

export const saveMessageIfNotExists = async ({
  id,
  chatId,
  message: chatMessage,
}: {
  id: string;
  chatId: string;
  message: ChatMessage;
}) => {
  try {
    return await db.transaction(async (tx) => {
      const dbMessage = chatMessageToDbMessage(chatMessage, chatId);
      dbMessage.id = id;

      const insertedMessages = await tx
        .insert(message)
        .values(dbMessage)
        .onConflictDoNothing()
        .returning({ id: message.id });

      if (insertedMessages.length === 0) {
        return false;
      }

      const mappedDBParts = mapUIMessagePartsToDBParts(chatMessage.parts, id);
      if (mappedDBParts.length > 0) {
        await tx.insert(part).values(mappedDBParts);
      }

      await updateChatUpdatedAt({ chatId });
      return true;
    });
  } catch (error) {
    logger.error({ chatId, error, id }, "saveMessageIfNotExists failed");
    throw error;
  }
};

export const saveChatMessages = async ({
  messages,
}: {
  messages: {
    id: string;
    chatId: string;
    message: ChatMessage;
  }[];
}) => {
  try {
    if (messages.length === 0) {
      return;
    }
    return await db.transaction(async (tx) => {
      // Insert messages (without parts - parts are stored in Part table)
      const dbMessages = messages.map(({ id, chatId, message: msg }) => {
        const dbMsg = chatMessageToDbMessage(msg, chatId);
        dbMsg.id = id;
        return dbMsg;
      });
      await tx.insert(message).values(dbMessages);

      // Save parts to Part table
      const allDbParts: Omit<Part, "id" | "createdAt">[] = [];
      for (const { id, message: msg } of messages) {
        const dbParts = mapUIMessagePartsToDBParts(msg.parts, id);
        allDbParts.push(...dbParts);
      }
      if (allDbParts.length > 0) {
        await tx.insert(part).values(allDbParts);
      }

      // Update chat's updatedAt timestamp for all affected chats
      const uniqueChatIds = [...new Set(messages.map(({ chatId }) => chatId))];
      await Promise.all(
        uniqueChatIds.map((chatId) => updateChatUpdatedAt({ chatId }))
      );
    });
  } catch (error) {
    logger.error(
      { error, messageIds: messages.map((m) => m.id) },
      "saveChatMessages failed"
    );
    throw error;
  }
};

export const updateMessage = async ({
  id,
  chatId,
  message: chatMessage,
}: {
  id: string;
  chatId: string;
  message: ChatMessage;
}) => {
  try {
    return await db.transaction(async (tx) => {
      // Convert ChatMessage to DBMessage (without parts)
      const dbMessage = chatMessageToDbMessage(chatMessage, chatId);
      dbMessage.id = id;

      // Update message (without parts - parts are stored in Part table)
      const updatedMessages = await tx
        .update(message)
        .set({
          activeStreamId: dbMessage.activeStreamId,
          annotations: dbMessage.annotations,
          attachments: dbMessage.attachments,
          createdAt: dbMessage.createdAt,
          isPrimaryParallel: dbMessage.isPrimaryParallel,
          lastContext: dbMessage.lastContext,
          parallelGroupId: dbMessage.parallelGroupId,
          parallelIndex: dbMessage.parallelIndex,
          parentMessageId: dbMessage.parentMessageId,
          selectedModel: dbMessage.selectedModel,
          selectedTool: dbMessage.selectedTool,
        })
        .where(
          and(
            eq(message.id, id),
            eq(message.chatId, chatId),
            isNull(message.canceledAt)
          )
        )
        .returning({ id: message.id });

      if (updatedMessages.length === 0) {
        return false;
      }

      // Update parts in Part table
      // Delete existing parts
      await tx.delete(part).where(eq(part.messageId, id));

      // Insert new parts
      const mappedDBParts = mapUIMessagePartsToDBParts(chatMessage.parts, id);
      if (mappedDBParts.length > 0) {
        await tx.insert(part).values(mappedDBParts);
      }

      return true;
    });
  } catch (error) {
    logger.error({ chatId, error, messageId: id }, "updateMessage failed");
    throw error;
  }
};

export const updateMessageActiveStreamId = ({
  id,
  activeStreamId,
}: {
  id: string;
  activeStreamId: string | null;
}) => db.update(message).set({ activeStreamId }).where(eq(message.id, id));

export const getAllMessagesByChatId = async ({
  chatId,
}: {
  chatId: string;
}): Promise<ChatMessage[]> => {
  try {
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt));

    if (messages.length === 0) {
      return [];
    }

    // Load all parts for all messages in a single query
    const messageIds = messages.map((msg) => msg.id);
    const allParts = await db
      .select()
      .from(part)
      .where(inArray(part.messageId, messageIds))
      .orderBy(asc(part.messageId), asc(part.order));

    // Group parts by messageId
    const partsByMessageId = new Map<string, Part[]>();
    for (const dbPart of allParts) {
      const existing = partsByMessageId.get(dbPart.messageId) ?? [];
      existing.push(dbPart);
      partsByMessageId.set(dbPart.messageId, existing);
    }

    // Reconstruct ChatMessage objects with parts from Part table
    return messages.map((msg) => {
      const dbParts = partsByMessageId.get(msg.id);
      const parts =
        dbParts && dbParts.length > 0 ? mapDBPartsToUIParts(dbParts) : [];

      return {
        id: msg.id,
        metadata: {
          activeStreamId: msg.activeStreamId,
          createdAt: msg.createdAt,
          isPrimaryParallel: msg.isPrimaryParallel,
          parallelGroupId: msg.parallelGroupId,
          parallelIndex: msg.parallelIndex,
          parentMessageId: msg.parentMessageId,
          selectedModel: isSelectedModelValue(msg.selectedModel)
            ? msg.selectedModel
            : ("" as ChatMessage["metadata"]["selectedModel"]),
          selectedTool: (msg.selectedTool ||
            undefined) as ChatMessage["metadata"]["selectedTool"],
          usage: msg.lastContext as ChatMessage["metadata"]["usage"],
        },
        parts,
        role: msg.role as ChatMessage["role"],
      };
    });
  } catch (error) {
    console.error("Failed to get all messages by chat ID", error);
    throw error;
  }
};

export const voteMessage = async ({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) => {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      isUpvoted: type === "up",
      messageId,
    });
  } catch (error) {
    console.error("Failed to upvote message in database", error);
    throw error;
  }
};

export const getVotesByChatId = async ({ id }: { id: string }) => {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error("Failed to get votes by chat id from database", error);
    throw error;
  }
};

export const saveDocument = async ({
  id,
  title,
  kind,
  content,
  userId,
  messageId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  messageId: string;
}) => {
  try {
    return await db.insert(document).values({
      content,
      createdAt: new Date(),
      id,
      kind,
      messageId,
      title,
      userId,
    });
  } catch (error) {
    console.error("Failed to save document in database", error);
    throw error;
  }
};

const _getDocumentsById = async ({ id }: { id: string }) => {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error("Failed to get document by id from database", error);
    throw error;
  }
};

export const getDocumentsById = async ({
  id,
  userId,
}: {
  id: string;
  userId?: string;
}) => {
  try {
    // First, get the document and check ownership
    const documents = await _getDocumentsById({ id });

    if (documents.length === 0) {
      return [];
    }

    const [doc] = documents;

    if (!userId || doc.userId !== userId) {
      // Need to check if chat is public
      const documentsWithVisibility = await db
        .select({
          chatVisibility: chat.visibility,
          content: document.content,
          createdAt: document.createdAt,
          id: document.id,
          kind: document.kind,
          messageId: document.messageId,
          title: document.title,
          userId: document.userId,
        })
        .from(document)
        .innerJoin(message, eq(document.messageId, message.id))
        .innerJoin(chat, eq(message.chatId, chat.id))
        .where(and(eq(document.id, id), eq(chat.visibility, "public")))
        .orderBy(asc(document.createdAt));

      return documentsWithVisibility;
    }

    return documents;
  } catch (error) {
    console.error(
      "Failed to get documents by id with visibility from database"
    );
    throw error;
  }
};

export const getPublicDocumentsById = async ({ id }: { id: string }) => {
  try {
    const documents = await db
      .select({
        content: document.content,
        createdAt: document.createdAt,
        id: document.id,
        kind: document.kind,
        messageId: document.messageId,
        title: document.title,
        userId: document.userId,
      })
      .from(document)
      .innerJoin(message, eq(document.messageId, message.id))
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(document.id, id), eq(chat.visibility, "public")))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error("Failed to get public documents by id from database");
    throw error;
  }
};

export const getDocumentById = async ({ id }: { id: string }) => {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error("Failed to get document by id from database");
    throw error;
  }
};

const _deleteDocumentsByIdAfterTimestamp = async ({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) => {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      "Failed to delete documents by id after timestamp from database"
    );
    throw error;
  }
};

export const getDocumentsByMessageIds = async ({
  messageIds,
}: {
  messageIds: string[];
}) => {
  if (messageIds.length === 0) {
    return [];
  }

  try {
    return await db
      .select()
      .from(document)
      .where(inArray(document.messageId, messageIds))
      .orderBy(asc(document.createdAt));
  } catch (error) {
    console.error("Failed to get documents by message IDs from database");
    throw error;
  }
};

export const saveDocuments = async ({
  documents,
}: {
  documents: {
    id: string;
    title: string;
    kind: ArtifactKind;
    content: string | null;
    userId: string;
    messageId: string;
    createdAt: Date;
  }[];
}) => {
  if (documents.length === 0) {
    return;
  }

  try {
    return await db.insert(document).values(documents);
  } catch (error) {
    console.error("Failed to save documents in database", error);
    throw error;
  }
};

export const getMessageById = async ({ id }: { id: string }) => {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    logger.error({ error, messageId: id }, "getMessageById failed");
    throw error;
  }
};

export const getChatMessageWithPartsById = async ({
  id,
}: {
  id: string;
}): Promise<{
  chatId: string;
  message: ChatMessage;
} | null> => {
  try {
    const [dbMessage] = await db
      .select()
      .from(message)
      .where(eq(message.id, id));
    if (!dbMessage) {
      return null;
    }

    const dbParts = await db
      .select()
      .from(part)
      .where(eq(part.messageId, id))
      .orderBy(asc(part.order));

    const role = dbMessage.role as ChatMessage["role"];
    const parts = dbParts.length > 0 ? mapDBPartsToUIParts(dbParts) : [];
    const metadata = {
      activeStreamId: dbMessage.activeStreamId,
      createdAt: dbMessage.createdAt,
      isPrimaryParallel: dbMessage.isPrimaryParallel,
      parallelGroupId: dbMessage.parallelGroupId,
      parallelIndex: dbMessage.parallelIndex,
      parentMessageId: dbMessage.parentMessageId,
      selectedModel: isSelectedModelValue(dbMessage.selectedModel)
        ? dbMessage.selectedModel
        : ("" as ChatMessage["metadata"]["selectedModel"]),
      selectedTool: (dbMessage.selectedTool ||
        undefined) as ChatMessage["metadata"]["selectedTool"],
      usage: dbMessage.lastContext as ChatMessage["metadata"]["usage"],
    };

    return {
      chatId: dbMessage.chatId,
      message: {
        id: dbMessage.id,
        metadata,
        parts,
        role,
      },
    };
  } catch (error) {
    logger.error(
      { error, messageId: id },
      "getChatMessageWithPartsById failed"
    );
    throw error;
  }
};

const _deleteMessagesByChatIdAfterTimestamp = async ({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) => {
  try {
    const messagesToDelete = await db
      .select()
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map((msg) => msg.id);

    if (messageIds.length > 0) {
      // Clean up attachments before deleting messages
      await deleteAttachmentsFromMessages(messagesToDelete);

      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (error) {
    console.error(
      "Failed to delete messages by id after timestamp from database"
    );
    throw error;
  }
};

export const deleteMessagesByChatIdAfterMessageId = async ({
  chatId,
  messageId,
}: {
  chatId: string;
  messageId: string;
}) => {
  try {
    // First, get the target message to find its position in the chat
    const [targetMessage] = await db
      .select()
      .from(message)
      .where(and(eq(message.id, messageId), eq(message.chatId, chatId)));

    if (!targetMessage) {
      throw new Error("Target message not found");
    }

    // Get all messages in the chat ordered by creation time
    const allMessages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt));

    // Find the index of the target message
    const targetIndex = allMessages.findIndex((msg) => msg.id === messageId);

    if (targetIndex === -1) {
      throw new Error("Target message not found in chat");
    }

    // Delete all messages after the target message (including the target itself)
    const messagesToDelete = allMessages.slice(targetIndex);
    const messageIdsToDelete = messagesToDelete.map((msg) => msg.id);

    if (messageIdsToDelete.length > 0) {
      // Clean up attachments before deleting messages
      await deleteAttachmentsFromMessages(messagesToDelete);

      // Delete the messages (votes will be deleted automatically via CASCADE)
      return await db
        .delete(message)
        .where(
          and(
            eq(message.chatId, chatId),
            inArray(message.id, messageIdsToDelete)
          )
        );
    }
  } catch (error) {
    console.error(
      "Failed to delete messages by chat id after message id from database"
    );
    throw error;
  }
};

export const updateChatVisiblityById = async ({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) => {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat visibility in database");
    throw error;
  }
};

export const updateChatTitleById = async ({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) => {
  try {
    return await db
      .update(chat)
      .set({
        title,
      })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat title by id from database");
    throw error;
  }
};

export const updateChatIsPinnedById = async ({
  chatId,
  isPinned,
}: {
  chatId: string;
  isPinned: boolean;
}) => {
  try {
    return await db
      .update(chat)
      .set({
        isPinned,
      })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat isPinned by id from database");
    throw error;
  }
};

export const getMessageCanceledAt = async ({
  messageId,
}: {
  messageId: string;
}): Promise<Date | null> => {
  try {
    const [result] = await db
      .select({ canceledAt: message.canceledAt })
      .from(message)
      .where(eq(message.id, messageId));
    return result?.canceledAt ?? null;
  } catch (error) {
    logger.error({ error, messageId }, "getMessageCanceledAt failed");
    throw error;
  }
};

export const requestGenerationCancellation = async ({
  canceledAt,
  chatId,
  messageId,
  userId,
}: {
  canceledAt: Date;
  chatId: string;
  messageId: string;
  userId: string;
}) => {
  try {
    await db
      .insert(generationCancellation)
      .values({ canceledAt, chatId, messageId, userId })
      .onConflictDoUpdate({
        set: { canceledAt, chatId },
        target: [
          generationCancellation.messageId,
          generationCancellation.userId,
        ],
      });
  } catch (error) {
    logger.error({ error, messageId }, "requestGenerationCancellation failed");
    throw error;
  }
};

export const isGenerationCancellationRequested = async ({
  chatId,
  messageId,
  userId,
}: {
  chatId: string;
  messageId: string;
  userId: string;
}) => {
  try {
    const [cancellation] = await db
      .select({ messageId: generationCancellation.messageId })
      .from(generationCancellation)
      .where(
        and(
          eq(generationCancellation.chatId, chatId),
          eq(generationCancellation.messageId, messageId),
          eq(generationCancellation.userId, userId)
        )
      )
      .limit(1);

    return !!cancellation;
  } catch (error) {
    logger.error(
      { error, messageId },
      "isGenerationCancellationRequested failed"
    );
    throw error;
  }
};

export const cancelActiveMessage = async ({
  canceledAt,
  chatId,
  messageId,
}: {
  canceledAt: Date;
  chatId: string;
  messageId: string;
}) => {
  try {
    const canceledMessages = await db
      .update(message)
      .set({ activeStreamId: null, canceledAt })
      .where(
        and(
          eq(message.chatId, chatId),
          eq(message.id, messageId),
          isNotNull(message.activeStreamId),
          isNull(message.canceledAt)
        )
      )
      .returning({ id: message.id });

    return canceledMessages.length > 0;
  } catch (error) {
    logger.error({ error, messageId }, "cancelActiveMessage failed");
    throw error;
  }
};

export const getUserById = async ({
  userId,
}: {
  userId: string;
}): Promise<User | undefined> => {
  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return users[0];
};

export const getAllAttachmentUrls = async (): Promise<string[]> => {
  try {
    const [messages, generatedImageParts, fileParts] = await Promise.all([
      getMessagesWithAttachments(),
      getGeneratedImageParts(),
      getFilePartUrls(),
    ]);

    const attachmentUrls = [
      ...collectMessageAttachmentUrls(messages),
      ...collectFilePartUrls(fileParts),
    ];

    // Collect URLs from generated images in tool outputs
    for (const p of generatedImageParts) {
      const output: unknown = p.tool_output;
      if (
        output &&
        typeof output === "object" &&
        "imageUrl" in output &&
        typeof output.imageUrl === "string" &&
        output.imageUrl
      ) {
        attachmentUrls.push(output.imageUrl);
      }
    }

    return [...new Set(attachmentUrls)];
  } catch (error) {
    console.error("Failed to get attachment URLs from database", error);
    throw error;
  }
};

export const getUserModelPreferences = async ({
  userId,
}: {
  userId: string;
}): Promise<UserModelPreference[]> => {
  try {
    return await db
      .select()
      .from(userModelPreference)
      .where(eq(userModelPreference.userId, userId));
  } catch (error) {
    console.error("Failed to get user model preferences from database", error);
    throw error;
  }
};

export const upsertUserModelPreference = async ({
  userId,
  modelId,
  enabled,
}: {
  userId: string;
  modelId: string;
  enabled: boolean;
}): Promise<void> => {
  try {
    await db
      .insert(userModelPreference)
      .values({
        createdAt: new Date(),
        enabled,
        modelId,
        updatedAt: new Date(),
        userId,
      })
      .onConflictDoUpdate({
        set: {
          enabled,
          updatedAt: new Date(),
        },
        target: [userModelPreference.userId, userModelPreference.modelId],
      });
  } catch (error) {
    console.error("Failed to upsert user model preference in database", error);
    throw error;
  }
};
