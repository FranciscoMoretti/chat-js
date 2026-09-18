import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { mockProvider } from "./mock-provider";
import {
  append,
  beginWriter,
  complete,
  editDocument,
  endWriter,
  fork,
  history,
  modelHistory,
  reserve,
  removeBranch,
  validatePrefix,
  writeFile,
} from "./model";
import type { Message } from "./model";

let directory: string;
let sql: ReturnType<typeof postgres>;
let started = false;
const owner = "alice";
const capture = {
  id: "boundary",
  intent: "before-user-2",
  owner,
  source: "root",
};
const text = (value: string): Message => ({
  parts: [{ text: value, type: "text" }],
  role: "user",
});

beforeAll(async () => {
  // No env files, URLs, shared services or remote DB acceptance path.
  directory = await mkdtemp(path.join(tmpdir(), "chatjs-branch-PROTOTYPE-"));
  execFileSync(
    "initdb",
    [
      "-D",
      path.join(directory, "pg"),
      "-A",
      "trust",
      "-U",
      "prototype",
      "--no-locale",
    ],
    { stdio: "ignore" }
  );
  execFileSync(
    "pg_ctl",
    [
      "-D",
      path.join(directory, "pg"),
      "-l",
      path.join(directory, "postgres.log"),
      "-o",
      `-k ${directory} -h '' -p 5432`,
      "-w",
      "start",
    ],
    { stdio: "ignore" }
  );
  started = true;
  sql = postgres({
    database: "postgres",
    host: directory,
    max: 5,
    port: 5432,
    user: "prototype",
  });
  await sql.unsafe(
    await readFile(new URL("schema.sql", import.meta.url), "utf-8")
  );
});
afterAll(async () => {
  await sql?.end();
  if (started) {
    execFileSync(
      "pg_ctl",
      ["-D", path.join(directory, "pg"), "-m", "immediate", "-w", "stop"],
      { stdio: "ignore" }
    );
  }
  if (directory) {
    await rm(directory, { force: true, recursive: true });
  }
});
beforeEach(async () => {
  await sql`truncate child_request,checkpoint,writer,branch,node,provider_snapshot,provider_vm,resource,annotation cascade`;
  await sql`insert into resource (id,owner,kind,bytes) values
    ('revision-1','alice','document','first revision'),
    ('revision-2','alice','document','edited revision'),
    ('owned/immutable-attachment','alice','file','PDF bytes'),
    ('foreign','bob','file','private')`;
  await sql`insert into provider_vm (id,files) values ('original','{"work.txt":"v1"}')`;
  await sql`insert into branch (id,owner,sandbox,documents) values ('root','alice','original','{"doc":"revision-1"}')`;
});

const add = (
  id: string,
  expectedHead: string | null,
  branch = "root",
  value = text(id)
) => append(sql, { branch, expectedHead, id, message: value, owner });
const checkpoint = async () => {
  await reserve(sql, capture);
  await complete(sql, mockProvider(sql), owner, capture.id);
};

const write = async (branch: string, bytes: string) => {
  await beginWriter(sql, owner, branch, "file-writer", "sandbox-process");
  await writeFile(sql, {
    branch,
    bytes,
    owner,
    path: "work.txt",
    writer: "file-writer",
  });
  await endWriter(sql, owner, branch, "file-writer");
};

test("shared immutable prefix, attachment references and annotations survive nested branches without duplicate messages", async () => {
  await add("m1", null, "root", {
    annotation: { selectedTool: "read" },
    parts: [
      {
        mediaType: "application/pdf",
        object: "owned/immutable-attachment",
        type: "file",
      },
    ],
    role: "user",
  });
  await checkpoint();
  await fork(sql, mockProvider(sql), {
    checkpoint: capture.id,
    child: "child",
    owner,
  });
  await add("m2", "m1", "child");
  await reserve(sql, { id: "nested", intent: "idle", owner, source: "child" });
  await complete(sql, mockProvider(sql), owner, "nested");
  await fork(sql, mockProvider(sql), {
    checkpoint: "nested",
    child: "grandchild",
    owner,
  });
  await add("parent-suffix", "m1");
  const rows1 = await sql`select id from node`;
  expect(rows1.length).toBe(3);
  expect(await history(sql, owner, "m2")).toEqual([
    {
      annotation: { selectedTool: "read" },
      parts: [
        {
          mediaType: "application/pdf",
          object: "owned/immutable-attachment",
          type: "file",
        },
      ],
      role: "user",
    },
    text("m2"),
  ]);
  expect(await history(sql, "bob", "m2")).toEqual([]);
  await expect(sql`update node set payload='{}' where id='m1'`).rejects.toThrow(
    "immutable message"
  );
});

test("stopping snapshot restores parent and independent child; later document and file edits stay isolated", async () => {
  await add("m1", null);
  await checkpoint();
  await editDocument(sql, owner, "root", { doc: "revision-2" });
  await write("root", "parent-v2");
  await fork(sql, mockProvider(sql), {
    checkpoint: capture.id,
    child: "child",
    owner,
  });
  const rows2 = await sql`select stopped from provider_vm where id='original'`;
  expect(rows2[0]?.stopped).toBe(true);
  const rows3 = await sql`select documents from branch where id='child'`;
  expect(rows3[0]?.documents).toEqual({ doc: "revision-1" });
  const rows4 = await sql`select files from provider_vm where id='child:child'`;
  expect(rows4[0]?.files).toEqual({ "work.txt": "v1" });
  await write("child", "child-v3");
  const rows5 =
    await sql`select files from provider_vm where id='parent:boundary'`;
  expect(rows5[0]?.files).toEqual({ "work.txt": "parent-v2" });
  await add("parent-next", "m1");
  await add("child-next", "m1", "child");
});

test.each([
  "turn",
  "completion-hook",
  "background-task",
  "approval",
  "external-edit",
])(
  "completion events cannot override an outstanding %s writer",
  async (kind) => {
    await beginWriter(sql, owner, "root", "writer", kind);
    await expect(reserve(sql, capture)).rejects.toThrow("writers not drained");
    await endWriter(sql, owner, "root", "writer");
    await reserve(sql, capture);
    await expect(beginWriter(sql, owner, "root", "late", kind)).rejects.toThrow(
      "capture barrier"
    );
    await expect(
      editDocument(sql, owner, "root", { doc: "late" })
    ).rejects.toThrow("capture barrier");
    await expect(add("late-message", null)).rejects.toThrow("capture barrier");
  }
);

test("concurrent writer admission and capture serialize: exactly one is admitted", async () => {
  const results = await Promise.allSettled([
    reserve(sql, capture),
    beginWriter(sql, owner, "root", "race", "tool"),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1);
});

test("lost snapshot response remains fenced; recovery reuses original receipt and survives coordinator reconstruction", async () => {
  await reserve(sql, capture);
  const provider = mockProvider(sql);
  await expect(
    complete(
      sql,
      {
        ...provider,
        async capture(key, vm) {
          await provider.capture(key, vm);
          throw new Error("lost provider reply");
        },
      },
      owner,
      capture.id
    )
  ).rejects.toThrow("lost provider reply");
  const rows6 = await sql`select status from checkpoint`;
  expect(rows6[0]?.status).toBe("failed");
  await expect(add("late", null)).rejects.toThrow("capture barrier");
  await complete(sql, mockProvider(sql), owner, capture.id);
  const rows7 = await sql`select status from checkpoint`;
  expect(rows7[0]?.status).toBe("ready");
  expect(await sql`select id from provider_snapshot`).toHaveLength(1);
});

test("crash after restore before publication retries without resnapshotting or overwriting parent", async () => {
  await reserve(sql, capture);
  await expect(
    complete(sql, mockProvider(sql), owner, capture.id, () => {
      throw new Error("crash before commit");
    })
  ).rejects.toThrow("crash before commit");
  await complete(sql, mockProvider(sql), owner, capture.id);
  await write("root", "continued");
  await Promise.all([
    complete(sql, mockProvider(sql), owner, capture.id),
    complete(sql, mockProvider(sql), owner, capture.id),
  ]);
  const rows8 =
    await sql`select files from provider_vm where id='parent:boundary'`;
  expect(rows8[0]?.files).toEqual({ "work.txt": "continued" });
  expect(await sql`select id from provider_vm`).toHaveLength(2);
});

test("pending checkpoint after process death is recoverable; changed intent and foreign ownership fail", async () => {
  await reserve(sql, capture);
  await expect(
    fork(sql, mockProvider(sql), {
      checkpoint: capture.id,
      child: "child",
      owner,
    })
  ).rejects.toThrow("checkpoint not ready");
  await expect(
    reserve(sql, { ...capture, intent: "different-boundary" })
  ).rejects.toThrow("conflicting operation");
  await expect(
    complete(sql, mockProvider(sql), "bob", capture.id)
  ).rejects.toThrow("not owned");
  await complete(sql, mockProvider(sql), owner, capture.id);
  await reserve(sql, capture);
  await expect(
    fork(sql, mockProvider(sql), {
      checkpoint: capture.id,
      child: "child",
      owner: "bob",
    })
  ).rejects.toThrow("not owned");
});

test("child creation is idempotent through lost replies, including after child continuation", async () => {
  await checkpoint();
  const request = { checkpoint: capture.id, child: "child", owner };
  const provider = mockProvider(sql);
  await expect(
    fork(
      sql,
      {
        ...provider,
        async restore(key, vm) {
          await provider.restore(key, vm);
          throw new Error("lost restore reply");
        },
      },
      request
    )
  ).rejects.toThrow("lost restore reply");
  await fork(sql, provider, request);
  await add("child-1", null, "child");
  await fork(sql, provider, request);
  const rows9 = await sql`select head from branch where id='child'`;
  expect(rows9[0]?.head).toBe("child-1");
  await reserve(sql, { ...capture, id: "other" });
  await complete(sql, provider, owner, "other");
  await expect(
    fork(sql, provider, { ...request, checkpoint: "other" })
  ).rejects.toThrow("conflicting child");
});

test("historical edit/regenerate uses the prior boundary, excludes suffix, retains original model annotation", async () => {
  await add("question-1", null);
  await add("answer-1", "question-1", "root", {
    annotation: { model: "original-model" },
    parts: [{ text: "first answer", type: "text" }],
    role: "assistant",
  });
  await checkpoint();
  await add("question-2", "answer-1");
  await add("answer-2", "question-2");
  await fork(sql, mockProvider(sql), {
    checkpoint: capture.id,
    child: "edit",
    owner,
  });
  await add("replacement-question", "answer-1", "edit");
  const selected = await history(sql, owner, "replacement-question");
  expect(selected).toHaveLength(3);
  expect(selected[1]?.annotation?.model).toBe("original-model");
  expect(selected.at(-1)).toEqual(text("replacement-question"));
  expect(await history(sql, owner, "answer-2")).toHaveLength(4);
});

test("tool pairs and bounded input fail closed; incomplete cancelled/failed turns cannot be captured", async () => {
  const call: Message = {
    parts: [{ id: "c", input: "{}", name: "read", type: "call" }],
    role: "assistant",
  };
  await add("call", null, "root", call);
  await expect(reserve(sql, capture)).rejects.toThrow("unresolved tool");
  const result: Message = {
    parts: [{ id: "c", output: "done", type: "result" }],
    role: "tool",
  };
  await add("result", "call", "root", result);
  await checkpoint();
  expect(() => validatePrefix([result])).toThrow("unpaired");
  expect(() => validatePrefix([call, call, result])).toThrow(
    "invalid tool call"
  );
  expect(() => validatePrefix([text("x".repeat(1_000_001))])).toThrow(
    "prefix too large"
  );
});

test("optimistic branch head compare prevents concurrent appends from losing messages", async () => {
  const results = await Promise.allSettled([add("a", null), add("b", null)]);
  expect(
    results.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1);
  expect(await sql`select id from node`).toHaveLength(1);
});

test("resource grants are owner checked and retained after source branch removal", async () => {
  await expect(
    add("foreign-file", null, "root", {
      parts: [{ mediaType: "text/plain", object: "foreign", type: "file" }],
      role: "user",
    })
  ).rejects.toThrow("resource not owned");
  await expect(
    editDocument(sql, owner, "root", { doc: "foreign" })
  ).rejects.toThrow("resource not owned");
  await add("attachment", null, "root", {
    parts: [
      {
        mediaType: "application/pdf",
        object: "owned/immutable-attachment",
        type: "file",
      },
    ],
    role: "user",
  });
  await checkpoint();
  await fork(sql, mockProvider(sql), {
    checkpoint: capture.id,
    child: "child",
    owner,
  });
  await removeBranch(sql, owner, "root");
  expect(await history(sql, owner, "attachment")).toHaveLength(1);
  const resources = await sql`select id from resource where owner='alice'`;
  expect(resources).toHaveLength(3);
  await add("after-deletion", "attachment", "child");
});

test("separate idle captures retain manual edits even when transcript head is unchanged", async () => {
  await checkpoint();
  await editDocument(sql, owner, "root", { doc: "revision-2" });
  await reserve(sql, { ...capture, id: "later", intent: "before-next-turn" });
  await complete(sql, mockProvider(sql), owner, "later");
  await fork(sql, mockProvider(sql), {
    checkpoint: "boundary",
    child: "early",
    owner,
  });
  await fork(sql, mockProvider(sql), {
    checkpoint: "later",
    child: "late",
    owner,
  });
  const rows =
    await sql`select documents from branch where id in ('early','late') order by id`;
  expect(rows.map((row) => row.documents)).toEqual([
    { doc: "revision-1" },
    { doc: "revision-2" },
  ]);
});

test("fork cannot reuse an unrelated branch or resurrect a deleted child", async () => {
  await checkpoint();
  await expect(
    fork(sql, mockProvider(sql), {
      checkpoint: "boundary",
      child: "root",
      owner,
    })
  ).rejects.toThrow("child already exists");
  const request = { checkpoint: "boundary", child: "child", owner };
  await fork(sql, mockProvider(sql), request);
  await removeBranch(sql, owner, "child");
  await expect(fork(sql, mockProvider(sql), request)).rejects.toThrow(
    "conflicting child"
  );
});

test("deletion during child restore fences publication", async () => {
  await checkpoint();
  const request = { checkpoint: "boundary", child: "child", owner };
  const provider = mockProvider(sql);
  await fork(sql, provider, request);
  await expect(
    fork(
      sql,
      {
        ...provider,
        async restore(key, vm) {
          await provider.restore(key, vm);
          await removeBranch(sql, owner, "child");
        },
      },
      request
    )
  ).rejects.toThrow("child deleted");
  const rows = await sql`select id from branch where id='child'`;
  expect(rows).toHaveLength(0);
});

test("app annotations are separate records and excluded from model history", async () => {
  await add("annotated", null, "root", {
    annotation: { model: "original", selectedTool: null },
    parts: [{ text: "answer", type: "text" }],
    role: "assistant",
  });
  const rows = await sql`select payload from node where id='annotated'`;
  expect(rows[0]?.payload).not.toHaveProperty("annotation");
  const annotations =
    await sql`select payload from annotation where node='annotated'`;
  expect(annotations[0]?.payload).toEqual({
    model: "original",
    selectedTool: null,
  });
  expect(await modelHistory(sql, owner, "annotated")).toEqual([
    { parts: [{ text: "answer", type: "text" }], role: "assistant" },
  ]);
});
