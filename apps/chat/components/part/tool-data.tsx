import React, { isValidElement } from "react";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockTitle,
} from "../ui/code-block";

const defaultPrimitives = {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockTitle,
};

export const ToolInput = ({
  input,
  primitives = defaultPrimitives,
}: {
  readonly primitives?: typeof defaultPrimitives;
  readonly input: unknown;
}): React.JSX.Element | null =>
  input === undefined ? null : (
    <primitives.CodeBlock size="sm">
      <primitives.CodeBlockHeader>
        <primitives.CodeBlockTitle>Parameters</primitives.CodeBlockTitle>
      </primitives.CodeBlockHeader>
      <primitives.CodeBlockContent wrap>
        {JSON.stringify(input, null, 2)}
      </primitives.CodeBlockContent>
    </primitives.CodeBlock>
  );

export const ToolOutput = ({
  output,
  errorText,
  primitives = defaultPrimitives,
}: {
  readonly primitives?: typeof defaultPrimitives;
  readonly output?: unknown;
  readonly errorText?: string;
}): React.JSX.Element | null => {
  if (errorText !== undefined && errorText !== "") {
    return (
      <primitives.CodeBlock size="sm" variant="destructive" role="alert">
        <primitives.CodeBlockHeader>
          <primitives.CodeBlockTitle>Error</primitives.CodeBlockTitle>
        </primitives.CodeBlockHeader>
        <primitives.CodeBlockContent wrap>
          {errorText}
        </primitives.CodeBlockContent>
      </primitives.CodeBlock>
    );
  }
  if (output === undefined) {
    return null;
  }
  if (isValidElement(output)) {
    return <div>{output}</div>;
  }
  let text: string | undefined;
  if (typeof output === "string") {
    text = output === "" ? '""' : output;
  } else if (typeof output === "bigint") {
    text = String(output);
  } else {
    text = JSON.stringify(output, null, 2);
  }
  return (
    <primitives.CodeBlock size="sm">
      <primitives.CodeBlockHeader>
        <primitives.CodeBlockTitle>Result</primitives.CodeBlockTitle>
      </primitives.CodeBlockHeader>
      <primitives.CodeBlockContent wrap>{text}</primitives.CodeBlockContent>
    </primitives.CodeBlock>
  );
};
