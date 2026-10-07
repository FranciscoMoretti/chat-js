# Oxlint cleanup status

PR #668 keeps the native Oxlint rule configuration and source-level exceptions in place. The prior suppression-count baseline and its parser gate have been removed; `bun lint` still runs the configured lint checks, but does not detect every newly added or widened suppression.

The current per-rule review is tracked in [#669](https://github.com/FranciscoMoretti/chat-js/issues/669). Its inventory is pinned to `e56e9b74be3ce464b7f49bb4d8367475c8000193`: 20,480 inline suppression memberships across 1,408 source paths. The 137 rule spellings normalize to 124 native rule IDs plus three config-only exceptions. Alias spellings are combined in each issue, while source and generated mirror paths remain counted separately. These counts describe suppressions, not findings or accepted justifications.

The historical readonly campaign began with 1,373 source memberships. At the PR head, 202 are reviewed (180 fixed, 19 justified with evidence, and 3 unresolved); 1,171 remain unreviewed. This narrower campaign is separate from the full per-rule inventory. Review status does not imply that any remaining exception is accepted.

Keep the rule-specific issue hierarchy current as source scopes change. For UI edits, follow the repository visual verification instructions and update selected generated mirrors from canonical sources.
