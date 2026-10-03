/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): CommandState preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type CommandState = {
  pending: boolean;
  cancelling: boolean;
  cancellation: number;
  failure?: Error;
};
/* oxlint-enable typescript/consistent-type-definitions */
const idle: CommandState = {
  cancellation: 0,
  cancelling: false,
  pending: false,
};

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * no-undefined (#519): LogicalCommands uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep LogicalCommands's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep LogicalCommands's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): LogicalCommands accepts change: Partial<CommandState>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Command locks belong to the execution session, never the selected view. */
export class LogicalCommands {
  private readonly states = new Map<string, CommandState>();
  private readonly listeners = new Set<() => void>();
  public get = (id: string) => this.states.get(id) ?? idle;
  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  public update(id: string, change: Partial<CommandState>): void {
    this.states.set(id, { ...this.get(id), ...change });
    for (const listener of this.listeners) {
      listener();
    }
  }
  public claim(id: string): boolean {
    if (this.get(id).pending) {
      return false;
    }
    this.update(id, { failure: undefined, pending: true });
    return true;
  }
}
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
