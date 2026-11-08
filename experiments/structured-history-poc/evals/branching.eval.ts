import { z } from "zod";
import assert from "node:assert/strict";
import { defineEval } from "eve/evals";
import { Client, conversationOf } from "eve/client";

export default defineEval({
  description: "ChatJS text-only branch boundaries on upstream EVE",
  timeoutMs: 120_000,
  async test(t) {
    const client = new Client({
      baseUrl: t.target.url,
      headers: { "x-poc-owner": "poc-owner" },
    });
    const start = async (
      message: string,
      source?: string,
      before?: string,
      operation?: string
    ) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-poc-owner": "poc-owner",
      };
      if (operation !== undefined) {
        headers["x-poc-operation"] = operation;
      }
      if (source !== undefined) {
        headers["x-poc-source"] = source;
      }
      if (before !== undefined) {
        headers["x-poc-before"] = before;
      }
      const response = await fetch(new URL("/eve/v1/session", t.target.url), {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });
      assert.equal(response.status, 202, await response.clone().text());
      const body: unknown = await response.json();
      assert.ok(
        typeof body === "object" &&
          body !== null &&
          "sessionId" in body &&
          typeof body.sessionId === "string"
      );
      const { sessionId } = body;
      const handle = client.sessions.attach(sessionId);
      for await (const event of handle.stream({
        follow: true,
        signal: AbortSignal.timeout(30_000),
      })) {
        if (event.type === "turn.settled") {
          assert.equal(event.data.outcome, "completed");
          break;
        }
      }
      return handle;
    };
    const read = async (handle: ReturnType<typeof client.sessions.attach>) => {
      const snapshot = await handle.snapshot();
      return conversationOf(snapshot.events).messages;
    };
    const answer = (messages: Awaited<ReturnType<typeof read>>): unknown => {
      const last = messages.at(-1);
      const text = last?.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
      const value = z
        .object({ users: z.array(z.string()), assistantCount: z.number() })
        .parse(JSON.parse(text ?? ""));
      return { users: value.users, assistantCount: value.assistantCount };
    };
    const original = await start("Q1");
    const second = await original.send("Q2");
    await second.result();
    const third = await original.send("Q3");
    await third.result();
    const originalMessages = await read(original);
    assert.equal(originalMessages.length, 6);
    const q2 = originalMessages.at(2);
    assert.ok(q2 !== undefined);
    const edited = await start("EDITED Q2", original.id, q2.id);
    const editedMessages = await read(edited);
    assert.equal(editedMessages.length, 4);
    assert.deepEqual(answer(editedMessages), {
      users: ["Q1", "EDITED Q2"],
      assistantCount: 1,
    });
    assert.deepEqual(
      await read(original),
      originalMessages,
      "editing must not mutate the original"
    );
    t.log("PASS: middle edit retains Q1/A1 and excludes Q2/A2/Q3/A3");
    const imported = editedMessages.filter(
      (message) => message.metadata?.imported
    );
    assert.deepEqual(
      imported.map((message) => message.metadata?.historyId),
      originalMessages.slice(0, 2).map((message) => message.id)
    );
    t.log(
      "PASS: imported display rows retain original message IDs in metadata.historyId"
    );
    const denied = await fetch(new URL("/eve/v1/session", t.target.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-poc-owner": "other-owner",
        "x-poc-source": original.id,
      },
      body: JSON.stringify({ message: "Unauthorized branch" }),
    });
    assert.notEqual(denied.status, 202);
    t.log("PASS: source owned by another caller cannot be imported");

    const regenerated = await start("Q2", original.id, q2.id);
    assert.deepEqual(answer(await read(regenerated)), {
      users: ["Q1", "Q2"],
      assistantCount: 1,
    });
    t.log("PASS: regenerate preserves prefix without appending the old answer");

    const editedQ2 = editedMessages.at(2);
    assert.ok(editedQ2 !== undefined);
    const nested = await start("NESTED Q2", edited.id, editedQ2.id);
    assert.deepEqual(answer(await read(nested)), {
      users: ["Q1", "NESTED Q2"],
      assistantCount: 1,
    });
    const [importedFirst] = editedMessages;
    const first = await start("REPLACED Q1", edited.id, importedFirst.id);
    assert.deepEqual(answer(await read(first)), {
      users: ["REPLACED Q1"],
      assistantCount: 0,
    });
    t.log("PASS: nested branch and edit of imported first message");

    const copied = await start("Q4", original.id);
    assert.deepEqual(answer(await read(copied)), {
      users: ["Q1", "Q2", "Q3", "Q4"],
      assistantCount: 3,
    });
    const followup = await edited.send("FOLLOWUP");
    await followup.result();
    assert.deepEqual(answer(await read(edited)), {
      users: ["Q1", "EDITED Q2", "FOLLOWUP"],
      assistantCount: 2,
    });
    t.log(
      "PASS: full-prefix continuation and subsequent send without duplicate import"
    );

    const rich = await start(
      "FOLLOW CAPTURED",
      undefined,
      undefined,
      "accepted-copy"
    );
    const richMessages = await read(rich);
    assert.equal(richMessages[0]?.metadata?.historyId, "captured-user");
    assert.equal(richMessages[1]?.metadata?.historyId, "captured-assistant");
    assert.ok(richMessages[0]?.parts.some((part) => part.type === "file"));
    assert.ok(richMessages[1]?.parts.some((part) => part.type === "reasoning"));
    const historicalTools =
      richMessages[1]?.parts.filter((part) => part.type === "tool") ?? [];
    assert.deepEqual(
      historicalTools.map((part) => part.state),
      ["completed", "rejected", "failed"]
    );
    assert.ok(historicalTools.every((part) => part.interaction === undefined));
    const modelText =
      richMessages
        .at(-1)
        ?.parts.filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("") ?? "";
    const modelHistory = z
      .object({
        tools: z.array(
          z.object({
            name: z.string(),
            output: z.unknown(),
            isError: z.boolean(),
          })
        ),
      })
      .parse(JSON.parse(modelText));
    assert.deepEqual(
      modelHistory.tools.map((tool) => [tool.name, tool.isError]),
      [
        ["historical-read", false],
        ["historical-write", true],
        ["historical-error", true],
      ]
    );
    assert.deepEqual(modelHistory.tools[0]?.output, { value: 42 });
    assert.ok(modelText.includes("historical-read"));
    assert.ok(modelText.includes("Not authorized"));
    assert.ok(modelText.includes("Unavailable"));
    assert.ok(modelText.includes("Attached file"), modelText);
    assert.ok(!modelText.includes("could not be stored"), modelText);
    assert.ok(!modelText.includes("SOURCE CHANGED"));
    const richSnapshot = await rich.snapshot();
    assert.ok(
      !richSnapshot.events.some((event) => event.type === "call.requested"),
      "import must not execute historical calls"
    );
    const richUser = richMessages.at(2);
    assert.ok(richUser !== undefined);
    const richNested = await start(
      "EDIT CAPTURED FOLLOWUP",
      rich.id,
      richUser.id
    );
    const nestedRichMessages = await read(richNested);
    assert.equal(nestedRichMessages[0]?.metadata?.historyId, "captured-user");
    assert.equal(
      nestedRichMessages[1]?.parts.filter((part) => part.type === "tool")
        .length,
      3
    );
    t.log(
      "PASS: captured structured history, completed tools without reexecution, file staging, and nested edit"
    );
    const wrongOwner = await fetch(new URL("/eve/v1/session", t.target.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-poc-owner": "other",
        "x-poc-operation": "accepted-copy",
      },
      body: JSON.stringify({ message: "Cannot import" }),
    });
    assert.notEqual(wrongOwner.status, 202);
    const empty = await fetch(new URL("/eve/v1/session", t.target.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-poc-owner": "poc-owner",
        "x-poc-operation": "accepted-copy",
      },
      body: JSON.stringify({}),
    });
    assert.equal(empty.status, 202);
    const emptyBody = z
      .object({ sessionId: z.string() })
      .parse(await empty.json());
    const emptyMessages = await read(
      client.sessions.attach(emptyBody.sessionId)
    );
    assert.deepEqual(
      emptyMessages,
      [],
      "no native copy-before-send display promised"
    );
    t.log("PASS: owner check and explicit pre-send native display limitation");
  },
});
