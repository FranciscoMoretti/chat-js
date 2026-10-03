/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named DocumentToolResult API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
