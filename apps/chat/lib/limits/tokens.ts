/* oxlint-disable import/group-exports --
 * import/group-exports (#523): MAX_INPUT_TOKENS stays exported at its declaration so its public contract is visible beside its implementation.
 */
// Centralized limits for tokens and derived character counts

// Maximum input tokens allowed for a single user message
export const MAX_INPUT_TOKENS = 50_000;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers --
 * import/group-exports (#523): MAX_MESSAGE_CHARS stays exported at its declaration so its public contract is visible beside its implementation.
 * no-magic-numbers (#517): MAX_MESSAGE_CHARS uses 3 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
// Derive maximum message characters as 3x tokens (rough heuristic)
export const MAX_MESSAGE_CHARS = MAX_INPUT_TOKENS * 3;
/* oxlint-enable import/group-exports, no-magic-numbers */
