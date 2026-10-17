# Application-owned model accounting

ChatJS records model attempts and provider receipts through an AI SDK model wrapper. This covers replies, subagents, compaction and follow-up suggestions. The application ledger owns monetary settlement; runtime model events and display annotations do not charge a second time. Independent tool receipts remain billable.

Accounting is best effort. Unknown or missing costs do not block current or future turns, subagents, compaction or suggestions. An unknown cost remains `null`, never an invented zero. Receipt replay can add missing evidence, but cannot replace conflicting identity, usage, provider metadata or an already recorded amount. Valid receipts and credit debits commit together and replay does not charge twice.

Authorization and business limits are separate. Model ownership is checked before provider execution, outside the best-effort write boundary. Known insufficient balances and exhausted guest quotas still reject new work. Provider failures and invalid ownership still propagate. Accounting write failures do not discard a valid provider response or cause another provider call.

The structured `eve.accounting` logger reports intent, response, receipt, tool-receipt and cursor write failures, plus missing costs/receipts. Logs contain owner, session, turn and attempt identifiers and fixed error categories; they omit prompts, secrets, raw provider payloads and exception messages. Operators can use these identifiers to investigate unresolved ledger entries. Failed storage can leave no recoverable receipt, so this is not a guarantee that every provider charge will be collected.

Tool reconciliation retains its cursor when a receipt is missing so later replay can settle it. Unknown model costs do not trigger runtime-history replay: model receipts belong to the application wrapper. No automatic provider resend, retry service, strict/best-effort mode switch, or historical billing migration is introduced.

This is a fresh-start contract. It does not support continuing old runtime sessions or importing prelaunch accounting. Runtime publication, pinned-package adoption and live database migration remain separate operations.
