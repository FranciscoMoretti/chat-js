interface StepInput {
  readonly message?: string;
  readonly context?: readonly string[];
  readonly correlationIds?: readonly string[];
}
interface ReceivedEvent {
  readonly type: string;
  readonly data: { readonly correlationIds?: readonly string[] };
}
interface Command {
  readonly sessionId: string;
  readonly command: {
    readonly delivery: { readonly deliveryId: string };
    readonly payload: StepInput;
  };
}
interface ParserResult {
  readonly correlationId?: string;
}
type Parser = (
  input: Readonly<Record<string, unknown>>
) => ParserResult | Response;
interface RuntimeModules {
  readonly "eve-channel/request": {
    readonly parseCreateBody: Parser;
    readonly parseSessionMessageBody: Parser;
  };
  readonly "channel/session": {
    readonly createSession: (
      id: string,
      dispatcher: {
        readonly dispatchSession: (input: Command) => Promise<{
          readonly status: "accepted";
          readonly sessionId: string;
          readonly deliveryId: string;
        }>;
      },
      metadata: { readonly channelKind: string; readonly channelName: string }
    ) => {
      readonly send: (
        message: string,
        options: { readonly auth: null; readonly correlationId: string }
      ) => Promise<unknown>;
    };
  };
  readonly "channel/adapter": {
    readonly defaultDeliverResult: (input: StepInput) => StepInput;
  };
  readonly "harness/messages": {
    readonly coalesceTurnInputs: (
      first: StepInput,
      second: StepInput
    ) => StepInput;
    readonly createTurnInputMessages: (input: StepInput) => unknown;
  };
  readonly "harness/emission": {
    readonly emitTurnPreamble: (
      emit: (event: ReceivedEvent) => Promise<void>,
      input: StepInput,
      state: {
        readonly sequence: number;
        readonly sessionStarted: boolean;
        readonly stepIndex: number;
        readonly turnId: string;
      },
      messages: readonly unknown[]
    ) => Promise<unknown>;
  };
}
export type { Command, Parser, ReceivedEvent, RuntimeModules };
