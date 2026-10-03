/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-shared-messages"; "../lib/eve/shared-messages" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { EveMessage, EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveSharedMessages } from "../components/eve/eve-shared-messages";
import { sharedEvePart } from "../lib/eve/shared-messages";
/* oxlint-enable import/no-relative-parent-imports */

const parts: EveMessagePart[] = [
  {
    approval: { id: "owner-approval-secret", isAutomatic: true },
    input: { note: "Published note" },
    state: "approval-requested",
    toolCallId: "approval",
    toolName: "example",
    type: "dynamic-tool",
  },
  {
    approval: { approved: false, id: "owner-approval-secret" },
    input: { note: "Declined note" },
    state: "output-denied",
    toolCallId: "declined",
    toolName: "example",
    type: "dynamic-tool",
  },
  {
    approval: { approved: true, id: "owner-approval-secret" },
    input: { text: "one two" },
    output: { characters: 7, charactersNoSpaces: 6, sentences: 1, words: 2 },
    state: "output-available",
    toolCallId: "complete",
    toolName: "wordCount",
    type: "dynamic-tool",
  },
  {
    input: {
      code: "1 + 1",
      language: "javascript",
      title: "Public code result",
    },
    output: {
      kind: "chatjs.tool-result",
      output: "Unrecognized",
      privateRuntimeToken: "runtime-private",
      status: "success",
      usage: { costUsd: 99 },
      version: 2,
    },
    state: "output-available",
    toolCallId: "malformed",
    toolName: "codeExecution",
    type: "dynamic-tool",
  },
];
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * typescript/prefer-readonly-parameter-types (#565): process.stdout.write accepts part; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): process.stdout.write keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
process.stdout.write(
  renderToStaticMarkup(
    createElement(EveSharedMessages, {
      messages: parts.map((part, index): EveMessage => ({
        id: `public-${index}`,
        parts: sharedEvePart(part),
        role: "assistant",
      })),
    })
  )
);
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
