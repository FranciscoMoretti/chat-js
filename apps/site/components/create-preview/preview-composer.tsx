"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { EveComposer } from "../../../chat/components/eve/eve-composer";
import { ParallelResponseModelPicker } from "../../../chat/components/parallel-responses/model-picker";
import { useDefaultModel } from "../../../chat/providers/default-model-provider";
import { expandSelectedModelValue } from "../../../chat/lib/ai/types";
import type { SelectedModelValue } from "../../../chat/lib/ai/types";

/** Local selection state; the composer and picker are the installed app's UI. */
export const PreviewComposer = (props: ComponentProps<typeof EveComposer>) => {
  const defaultModel = useDefaultModel();
  const [selection, setSelection] = useState<SelectedModelValue>(defaultModel);
  return (
    <EveComposer
      {...props}
      modelIds={expandSelectedModelValue(selection)}
      modelPicker={
        <ParallelResponseModelPicker
          disabled={props.disabled}
          modelSelection={{ value: selection, onChange: setSelection }}
        />
      }
    />
  );
};
