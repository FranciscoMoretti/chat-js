import type { SelectedModelValue } from "@/lib/ai/types";

export interface TurnModelPickerProps {
  readonly value: SelectedModelValue;
  readonly onChange: (value: SelectedModelValue) => void | Promise<void>;
  readonly retainedModelId?: string;
  readonly retainedModelIds?: readonly string[];
  readonly disabled?: boolean;
}
