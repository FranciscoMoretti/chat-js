import { z } from "zod";
import { eveManualDocumentInput } from "../../../chat/chatjs/core/documents/contracts";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../chat/trpc/routers/_app";

export const sampleDocuments = {
  text: {
    documentId: "00000000-0000-4000-8000-000000000003",
    revisionId: "00000000-0000-4000-8000-000000000004",
    title: "Launch notes",
    kind: "text",
    content:
      "# Launch notes\n\nStart with one useful conversation.\n\n- Keep the scope small.\n- Make every interaction clear.",
  },
  code: {
    documentId: "00000000-0000-4000-8000-000000000005",
    revisionId: "00000000-0000-4000-8000-000000000006",
    title: "launch.py",
    kind: "code",
    content: 'print("Ready to launch!")',
  },
  sheet: {
    documentId: "00000000-0000-4000-8000-000000000007",
    revisionId: "00000000-0000-4000-8000-000000000008",
    title: "Launch checklist",
    kind: "sheet",
    content: "Task,Status\nDesign,Done\nBuild,In progress\nLaunch,Planned",
  },
} as const;

export const sampleDocument = {
  ...sampleDocuments.text,
  date: "2026-01-01T00:00:00.000Z",
  status: "success",
  result: "Created launch notes.",
} as const;

type Document = NonNullable<inferRouterOutputs<AppRouter>["eve"]["document"]>;
export const createPreviewDocument = (
  kind: keyof typeof sampleDocuments = "text"
): Document => {
  const sample = sampleDocuments[kind];
  return {
    canEdit: true,
    history: [
      {
        id: sample.revisionId,
        kind: sample.kind,
        title: sample.title,
        createdAt: new Date(sampleDocument.date),
        parentRevisionId: null,
        turnIndex: null,
      },
    ],
    revision: {
      id: sample.revisionId,
      documentId: sample.documentId,
      kind: sample.kind,
      title: sample.title,
      createdAt: new Date(sampleDocument.date),
      content: sample.content,
    },
  };
};

export const createDocumentFixtures = (failMutation: () => void) => {
  const documents = new Map(
    Object.values(sampleDocuments).map(({ kind }) => {
      const document = createPreviewDocument(kind);
      return [document.revision.documentId, document] as const;
    })
  );
  const revisions = new Map(
    [...documents.values()].map((document) => [
      document.revision.id,
      document.revision,
    ])
  );
  const resolve = (path: string, input: unknown): unknown => {
    if (path === "eve.document") {
      const { documentId, revisionId } = z
        .object({ documentId: z.string(), revisionId: z.string().optional() })
        .parse(input);
      const document = documents.get(documentId);
      if (!document) {
        throw new Error("Sample document not found");
      }
      const revision =
        revisionId === undefined
          ? document.revision
          : revisions.get(revisionId);
      if (!revision || revision.documentId !== documentId) {
        throw new Error("Sample revision not found");
      }
      return { ...document, revision } satisfies Document;
    }
    if (path === "eve.saveDocument") {
      failMutation();
      const data = eveManualDocumentInput.parse(input);
      let document = documents.get(data.documentId);
      if (!document) {
        throw new Error("Sample document not found");
      }
      if (
        data.documentId !== document.revision.documentId ||
        data.expectedRevisionId !== document.revision.id
      ) {
        throw new Error("Sample document changed; reload before saving");
      }
      const id = crypto.randomUUID();
      const createdAt = new Date();
      const revision = {
        ...document.revision,
        id,
        title: data.title,
        content: data.content,
        createdAt,
      };
      document = {
        ...document,
        history: [
          ...document.history,
          {
            id,
            kind: document.revision.kind,
            title: data.title,
            createdAt,
            parentRevisionId: document.revision.id,
            turnIndex: null,
          },
        ],
        revision,
      };
      documents.set(data.documentId, document);
      revisions.set(id, revision);
      return {
        id,
        documentId: data.documentId,
        content: data.content,
        createdAt,
        title: data.title,
        kind: revision.kind,
      } satisfies inferRouterOutputs<AppRouter>["eve"]["saveDocument"];
    }
    throw new Error(`Unsupported preview document operation: ${path}`);
  };
  return { resolve };
};
