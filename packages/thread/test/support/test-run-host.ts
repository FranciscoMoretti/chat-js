import type { ChatStatus, ChatTransport, UIMessage } from "ai";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { ThreadRunHost, ThreadRunSpec } from "../../src/ai-sdk-run-chat";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { MessageTree } from "../../src/message-tree";
/* oxlint-enable import/no-relative-parent-imports */

const generateMessageId = (): string => "client-response";
const registerToolCall: ThreadRunHost<UIMessage>["registerToolCall"] =
  (): void => {
    /* This host fixture does not persist tool-call registrations. */
  };

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class TestRunHost implements ThreadRunHost<UIMessage> {
  public readonly dataPartSchemas = undefined;
  public readonly id = "thread";
  public readonly messageMetadataSchema = undefined;
  public readonly generateMessageId = generateMessageId;
  public readonly spec: ThreadRunSpec;
  public readonly tree: MessageTree;
  public onData: ThreadRunHost<UIMessage>["onData"];
  public onError: ThreadRunHost<UIMessage>["onError"];
  public onFinish: ThreadRunHost<UIMessage>["onFinish"];
  public onToolCall: ThreadRunHost<UIMessage>["onToolCall"];
  public sendAutomaticallyWhen: ThreadRunHost<UIMessage>["sendAutomaticallyWhen"];
  public transport: ChatTransport<UIMessage>;
  public status: ChatStatus = "ready";
  public readonly errors: Error[] = [];

  public constructor(
    transport: ChatTransport<UIMessage>,
    initialMessage: UIMessage,
    spec: ThreadRunSpec
  ) {
    this.transport = transport;
    this.spec = spec;
    this.tree = new MessageTree({ messages: [initialMessage] });
  }

  public getMessagePath = (messageId: string | null): UIMessage[] =>
    this.tree.getPath(messageId);
  public updateRunPath = (messages: UIMessage[]): void => {
    this.tree.updatePath(messages);
  };
  public registerToolCall = registerToolCall;
  public removeMessage = (messageId: string): void =>
    this.tree.removeLeaf(messageId);
  public setRunError = (_runId: string, error: Error | undefined): void => {
    if (error) {
      this.errors.push(error);
    }
  };
  public setRunStatus = (_runId: string, status: ChatStatus): void => {
    this.status = status;
  };
  public writeRunMessage = (_runId: string, message: UIMessage): void => {
    if (
      typeof this.spec.messageId === "string" &&
      this.spec.messageId !== "" &&
      this.spec.messageId !== message.id
    ) {
      throw new Error("Run message identity changed");
    }
    if (
      !(
        typeof this.spec.messageId === "string" && this.spec.messageId !== ""
      ) &&
      this.tree.has(message.id)
    ) {
      throw new Error("Run message identity already exists");
    }
    this.spec.messageId = message.id;
    this.tree.upsertMessage(message, this.spec.parentMessageId);
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
