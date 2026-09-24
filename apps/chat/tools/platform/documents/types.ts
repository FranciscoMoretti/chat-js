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
