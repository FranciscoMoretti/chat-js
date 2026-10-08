// Centralized limits for tokens and derived character counts

// Maximum input tokens allowed for a single user message
const MAX_INPUT_TOKENS = 50_000;

// Derive maximum message characters as 3x tokens (rough heuristic)
const ESTIMATED_CHARACTERS_PER_TOKEN = 3;
const MAX_MESSAGE_CHARS = MAX_INPUT_TOKENS * ESTIMATED_CHARACTERS_PER_TOKEN;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (MAX_INPUT_TOKENS, MAX_MESSAGE_CHARS); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { MAX_INPUT_TOKENS, MAX_MESSAGE_CHARS };
/* oxlint-enable import/no-named-export */
