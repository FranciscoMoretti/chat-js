import { test } from "vitest";

import { captureChatStory } from "../_shared/visual";
import { WordCountRenderer } from "./renderer";

const messageId = "word-count-message";

test("word-count renders every state in the chat", () =>
  captureChatStory("word-count", [
    {
      label: "Counting",
      ui: (
        <WordCountRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { text: "one two three" },
            state: "input-available",
            toolCallId: "word-count-input",
          }}
        />
      ),
    },
    {
      label: "Counted",
      ui: (
        <WordCountRenderer
          isReadonly
          messageId={messageId}
          tool={{
            input: { text: "one two three" },
            output: {
              characters: 13,
              charactersNoSpaces: 11,
              sentences: 1,
              words: 3,
            },
            state: "output-available",
            toolCallId: "word-count-output",
          }}
        />
      ),
    },
  ]));
