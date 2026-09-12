import { z } from "zod";

// Provider metadata schema - using unknown since we don't have a specific schema
const providerMetadataSchema = z.unknown().optional();

/**
 * Zod validators for each UI message part type
 * Used to validate parts before mapping to database Part rows
 */

const textPartSchema = z.object({
  providerMetadata: providerMetadataSchema,
  state: z.enum(["streaming", "done"]).optional(),
  text: z.string(),
  type: z.literal("text"),
});

const reasoningPartSchema = z.object({
  providerMetadata: providerMetadataSchema,
  state: z.enum(["streaming", "done"]).optional(),
  text: z.string(),
  type: z.literal("reasoning"),
});

const filePartSchema = z.object({
  filename: z.string().optional(),
  mediaType: z.string(),
  providerMetadata: providerMetadataSchema,
  type: z.literal("file"),
  url: z.string(),
});

const sourceUrlPartSchema = z.object({
  providerMetadata: providerMetadataSchema,
  sourceId: z.string(),
  title: z.string().optional(),
  type: z.literal("source-url"),
  url: z.string(),
});

const sourceDocumentPartSchema = z.object({
  filename: z.string().optional(),
  mediaType: z.string(),
  providerMetadata: providerMetadataSchema,
  sourceId: z.string(),
  title: z.string(),
  type: z.literal("source-document"),
});

const stepStartPartSchema = z.object({
  type: z.literal("step-start"),
});

const dataPartSchema = z.object({
  data: z.unknown(),
  id: z.string().optional(),
  type: z.string().startsWith("data-"),
});

// Tool part schemas for different states
const toolPartInputStreamingSchema = z.object({
  approval: z.never().optional(),
  errorText: z.never().optional(),
  input: z.unknown().optional(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("input-streaming"),
  toolCallId: z.string(),
  type: z.string().startsWith("tool-"),
});

const toolPartInputAvailableSchema = z.object({
  approval: z.never().optional(),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("input-available"),
  toolCallId: z.string(),
  type: z.string().startsWith("tool-"),
});

const toolPartApprovalRequestedSchema = z.object({
  approval: z.object({
    id: z.string(),
    approved: z.never().optional(),
    reason: z.never().optional(),
  }),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("approval-requested"),
  toolCallId: z.string(),
  type: z.string().startsWith("tool-"),
});

const toolPartApprovalRespondedSchema = z.object({
  approval: z.object({
    id: z.string(),
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("approval-responded"),
  toolCallId: z.string(),
  type: z.string().startsWith("tool-"),
});

const toolPartOutputAvailableSchema = z.object({
  approval: z
    .object({
      id: z.string(),
      approved: z.literal(true),
      reason: z.string().optional(),
    })
    .optional(),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.unknown(),
  preliminary: z.boolean().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("output-available"),
  toolCallId: z.string(),
  type: z.string().startsWith("tool-"),
});

const toolPartOutputErrorSchema = z.object({
  approval: z
    .object({
      id: z.string(),
      approved: z.literal(true),
      reason: z.string().optional(),
    })
    .optional(),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.string(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("output-error"),
  toolCallId: z.string(),
  type: z.string().startsWith("tool-"),
});

const toolPartOutputDeniedSchema = z.object({
  approval: z.object({
    id: z.string(),
    approved: z.literal(false),
    reason: z.string().optional(),
  }),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("output-denied"),
  toolCallId: z.string(),
  type: z.string().startsWith("tool-"),
});

// Union schema for all tool part states
const toolPartSchema = z.union([
  toolPartInputStreamingSchema,
  toolPartInputAvailableSchema,
  toolPartApprovalRequestedSchema,
  toolPartApprovalRespondedSchema,
  toolPartOutputAvailableSchema,
  toolPartOutputErrorSchema,
  toolPartOutputDeniedSchema,
]);

// Dynamic tool part schemas
const dynamicToolPartInputStreamingSchema = z.object({
  approval: z.never().optional(),
  errorText: z.never().optional(),
  input: z.unknown().optional(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("input-streaming"),
  title: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("dynamic-tool"),
});

const dynamicToolPartInputAvailableSchema = z.object({
  approval: z.never().optional(),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("input-available"),
  title: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("dynamic-tool"),
});

const dynamicToolPartApprovalRequestedSchema = z.object({
  approval: z.object({
    id: z.string(),
    approved: z.never().optional(),
    reason: z.never().optional(),
  }),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("approval-requested"),
  title: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("dynamic-tool"),
});

const dynamicToolPartApprovalRespondedSchema = z.object({
  approval: z.object({
    id: z.string(),
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("approval-responded"),
  title: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("dynamic-tool"),
});

const dynamicToolPartOutputAvailableSchema = z.object({
  approval: z
    .object({
      id: z.string(),
      approved: z.literal(true),
      reason: z.string().optional(),
    })
    .optional(),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.unknown(),
  preliminary: z.boolean().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("output-available"),
  title: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("dynamic-tool"),
});

const dynamicToolPartOutputErrorSchema = z.object({
  approval: z
    .object({
      id: z.string(),
      approved: z.literal(true),
      reason: z.string().optional(),
    })
    .optional(),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.string(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("output-error"),
  title: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("dynamic-tool"),
});

const dynamicToolPartOutputDeniedSchema = z.object({
  approval: z.object({
    id: z.string(),
    approved: z.literal(false),
    reason: z.string().optional(),
  }),
  callProviderMetadata: providerMetadataSchema,
  errorText: z.never().optional(),
  input: z.unknown(),
  output: z.never().optional(),
  providerExecuted: z.boolean().optional(),
  state: z.literal("output-denied"),
  title: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("dynamic-tool"),
});

// Union schema for all dynamic tool part states
const dynamicToolPartSchema = z.union([
  dynamicToolPartInputStreamingSchema,
  dynamicToolPartInputAvailableSchema,
  dynamicToolPartApprovalRequestedSchema,
  dynamicToolPartApprovalRespondedSchema,
  dynamicToolPartOutputAvailableSchema,
  dynamicToolPartOutputErrorSchema,
  dynamicToolPartOutputDeniedSchema,
]);

// Union schema for all part types
const _messagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  filePartSchema,
  sourceUrlPartSchema,
  sourceDocumentPartSchema,
  stepStartPartSchema,
  dataPartSchema,
  toolPartSchema,
  dynamicToolPartSchema,
]);

/**
 * Validates a tool part and returns the result
 * Returns result with success flag - if validation fails, the part should be skipped
 */
export const validateToolPart = (part: unknown) =>
  toolPartSchema.safeParse(part);

/**
 * Validates a dynamic tool part and returns the result
 * Returns result with success flag - if validation fails, the part should be skipped
 */
export const validateDynamicToolPart = (part: unknown) =>
  dynamicToolPartSchema.safeParse(part);
