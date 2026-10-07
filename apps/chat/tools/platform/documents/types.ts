/* oxlint-disable import/no-named-export -- Keep the named type bindings (DocumentToolResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type DocumentToolResult =
  | {
      status: "success";
      documentId: string;
      result: string;
      date: string;
    }
  | {
      status: "error";
      error: string;
    };
/* oxlint-enable import/no-named-export */
