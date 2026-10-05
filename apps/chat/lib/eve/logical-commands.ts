import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (LogicalCommands); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-undefined --
 * no-undefined (#519): LogicalCommands uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
/** Command locks belong to the execution session, never the selected view. */
export class LogicalCommands {
  private readonly states = new Map<string, CommandState>();
  private readonly listeners = new Set<() => void>();
  public get = (id: string): CommandState => this.states.get(id) ?? idle;
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  public update(
    id: string,
    change: ReadonlyNativeSurface<Partial<CommandState>>
  ): void {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-undefined */
