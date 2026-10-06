import { z } from "zod";

const submissionSchema = z.object({
  operationId: z.string(),
  ownerId: z.string(),
  selectedTool: z.string().nullable(),
  sessionId: z.string(),
  status: z.enum(["uncertain", "admitted", "received"]),
});
type Submission = z.infer<typeof submissionSchema>;
interface Scope {
  readonly ownerId: string;
  readonly sessionId: string;
}
interface Receipt {
  readonly type: string;
  readonly data: { readonly correlationIds?: readonly string[] };
}
interface Projection {
  readonly submissions: readonly Submission[];
  readonly annotation?: { readonly selectedTool: string | null };
}
const reconcile = (
  submissions: readonly Readonly<Submission>[],
  scope: Scope,
  event: Receipt
): Projection => {
  const ids = event.data.correlationIds;
  if (event.type !== "message.received" || !ids) {
    return { submissions };
  }
  const scoped = submissions.filter(
    (row) => row.ownerId === scope.ownerId && row.sessionId === scope.sessionId
  );
  const matched = new Set(
    scoped.filter((row) => ids.includes(row.operationId))
  );
  const finalIndex = -1;
  const last = scoped.find((row) => row.operationId === ids.at(finalIndex));
  return {
    ...(last ? { annotation: { selectedTool: last.selectedTool } } : {}),
    submissions: submissions.map((row) =>
      matched.has(row) ? { ...row, status: "received" } : row
    ),
  };
};
export { reconcile, submissionSchema };
