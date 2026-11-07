import { z } from "zod";
import { eveManualDocumentInput } from "../../../chat/chatjs/core/documents/contracts";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../chat/trpc/routers/_app";

export const sampleDocument = {
  documentId: "00000000-0000-4000-8000-000000000003",
  revisionId: "00000000-0000-4000-8000-000000000004",
  title: "Launch notes",
  kind: "text",
  date: "2026-01-01T00:00:00.000Z",
  status: "success",
  result: "Created launch notes.",
} as const;

type Document = NonNullable<inferRouterOutputs<AppRouter>["eve"]["document"]>;
export const createPreviewDocument = (): Document => ({
  canEdit: true,
  history: [
    {
      id: sampleDocument.revisionId,
      kind: "text",
      title: sampleDocument.title,
      createdAt: new Date(sampleDocument.date),
      parentRevisionId: null,
      turnIndex: null,
    },
  ],
  revision: {
    id: sampleDocument.revisionId,
    documentId: sampleDocument.documentId,
    kind: "text",
    title: sampleDocument.title,
    createdAt: new Date(sampleDocument.date),
    content:
      "# Launch notes\n\nStart with one useful conversation.\n\n- Keep the scope small.\n- Make every interaction clear.",
  },
});

export const createDocumentFixtures = (failMutation: () => void) => {
  let document = createPreviewDocument();
  const revisions = new Map([[document.revision.id, document.revision]]);
  const resolve = (path: string, input: unknown): unknown => {
    if (path === "eve.document") {
      const { documentId, revisionId } = z
        .object({ documentId: z.string(), revisionId: z.string().optional() })
        .parse(input);
      if (documentId !== document.revision.documentId) {
        throw new Error("Sample document not found");
      }
      const revision =
        revisionId === undefined
          ? document.revision
          : revisions.get(revisionId);
      if (!revision) {
        throw new Error("Sample revision not found");
      }
      return { ...document, revision } satisfies Document;
    }
    if (path === "eve.saveDocument") {
      failMutation();
      const data = eveManualDocumentInput.parse(input);
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
            kind: "text",
            title: data.title,
            createdAt,
            parentRevisionId: document.revision.id,
            turnIndex: null,
          },
        ],
        revision,
      };
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
