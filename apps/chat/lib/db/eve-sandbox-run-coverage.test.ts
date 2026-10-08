import { expect, it } from "vitest";

import { classifyEveSandboxRuns } from "./eve-sandbox-run-coverage";

const DEEP_FAMILY_RUN_COUNT = 10_000;
const FIRST_CHILD_RUN_INDEX = 1;

/* oxlint-disable max-params, unicorn/no-null --
 * max-params (#511): run keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): run preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const run = (
  id: string,
  kind: string,
  parentId: string | null = null,
  eveParentId: string | null = null
): {
  eveParentId: string | null;
  id: string;
  parentId: string | null;
  workflowName: string;
} => ({ eveParentId, id, parentId, workflowName: `workflow//eve//${kind}` });
/* oxlint-enable max-params, unicorn/no-null */
it("identifies independent child receipts and covers ordinary work", () => {
  expect(
    classifyEveSandboxRuns([
      run("root", "workflowEntry"),
      run("turn", "turnWorkflow", "root"),
      run("timer", "sessionTimeoutWorkflow", "root"),
      run("child", "workflowEntry", "turn"),
      run("child-turn", "turnWorkflow", "child"),
    ])
  ).toEqual({ sessionIds: ["child", "root"], unresolvedRunIds: [] });
});
it("requires every ancestry path and rejects unknown authored wrappers", () => {
  expect(
    classifyEveSandboxRuns([
      run("root", "workflowEntry"),
      run("unknown", "workflowToolRunWorkflow", "root"),
      run("nested", "turnWorkflow", "unknown"),
      run("orphan", "turnWorkflow"),
      run("missing", "turnWorkflow", "root", "absent"),
      run("future", "workflowEntry@future", "root"),
    ])
  ).toEqual({
    sessionIds: ["root"],
    unresolvedRunIds: ["future", "missing", "nested", "orphan", "unknown"],
  });
});
it("accepts converging ancestry", () => {
  expect(
    classifyEveSandboxRuns([
      run("root", "workflowEntry"),
      run("a", "turnWorkflow", "root"),
      run("b", "turnWorkflow", "root"),
      run("c", "turnWorkflow", "a", "b"),
    ]).unresolvedRunIds
  ).toEqual([]);
});
it("rejects cycles even with a valid additional parent", () => {
  expect(
    classifyEveSandboxRuns([
      run("root", "workflowEntry"),
      run("a", "turnWorkflow", "b", "root"),
      run("b", "turnWorkflow", "a"),
    ]).unresolvedRunIds
  ).toEqual(["a", "b"]);
});
it.each(["0.52.2", "0.61.0"])(
  "only covers reviewed sleep workflow identities (%s)",
  (version) => {
    const sleep = {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing run("sleep", "executeSleepTool", "root") own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...run("sleep", "executeSleepTool", "root"),
      workflowName: `workflow//eve@${version}//executeSleepTool`,
    };
    expect(
      classifyEveSandboxRuns([run("root", "workflowEntry"), sleep])
        .unresolvedRunIds
    ).toEqual([]);
    expect(
      classifyEveSandboxRuns([
        run("root", "workflowEntry"),
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing sleep own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        { ...sleep, workflowName: "workflow//eve@0.53.0//executeSleepTool" },
      ]).unresolvedRunIds
    ).toEqual(["sleep"]);
  }
);
it("handles deep families without recursive stack growth", () => {
  const runs = [run("0", "workflowEntry")];
  for (
    let index = FIRST_CHILD_RUN_INDEX;
    index < DEEP_FAMILY_RUN_COUNT;
    index += FIRST_CHILD_RUN_INDEX
  ) {
    runs.push(
      run(String(index), "turnWorkflow", String(index - FIRST_CHILD_RUN_INDEX))
    );
  }
  expect(classifyEveSandboxRuns(runs).unresolvedRunIds).toEqual([]);
});
