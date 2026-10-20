/** Server-owned guest policy. Public constants describe limits, never authorize them. */
export const GUEST_POLICY = {
  version: "1",
  modelId: "openai/gpt-5-nano",
  messageLimit: 10,
  requestsPerMinute: 5,
  sessionsPerHour: 5,
  credentialDurationMs: 3_600_000,
  retentionMs: 86_400_000,
  maxMessageCharacters: 4000,
  maxInputCharacters: 24_000,
  maxOutputTokens: 512,
} as const;

export const GUEST_INSTRUCTIONS =
  "You are a helpful assistant. This is a temporary text conversation. You have no tools, files, saved user history, or ability to perform external actions.";
