// Centralized limits for tokens and derived character counts

// Maximum input tokens allowed for a single user message
const MAX_INPUT_TOKENS = 50_000;

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): MAX_MESSAGE_CHARS uses 3 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
// Derive maximum message characters as 3x tokens (rough heuristic)
const MAX_MESSAGE_CHARS = MAX_INPUT_TOKENS * 3;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (MAX_INPUT_TOKENS, MAX_MESSAGE_CHARS); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers */
export { MAX_INPUT_TOKENS, MAX_MESSAGE_CHARS };
/* oxlint-enable import/no-named-export */
