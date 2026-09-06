import type { ModelId } from "./models";
import type { useSetModel } from "./view";

const valid: ModelId = "careful";
// @ts-expect-error typed local module preserves the selected model union
const invalid: ModelId = "uninstalled";
function verify(setModel: ReturnType<typeof useSetModel>) {
	setModel(valid);
	// @ts-expect-error hook rejects uninstalled models without a component factory
	setModel("uninstalled");
}
void invalid;
void verify;
