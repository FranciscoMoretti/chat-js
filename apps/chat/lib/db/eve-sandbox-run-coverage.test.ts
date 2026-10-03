import { expect, it } from "vitest";

import { classifyEveSandboxRuns } from "./eve-sandbox-run-coverage";

/* oxlint-disable max-params, typescript/explicit-function-return-type, unicorn/no-null --
 * max-params (#511): run keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep run's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): run preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const run = (
  id: string,
  kind: string,
  parentId: string | null = null,
  eveParentId: string | null = null
) => ({ eveParentId, id, parentId, workflowName: `workflow//eve//${kind}` });
/* oxlint-enable max-params, typescript/explicit-function-return-type, unicorn/no-null */
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
/* oxlint-disable oxc/no-rest-spread-properties --
 * oxc/no-rest-spread-properties (#543): it.each(["0.52.2", "0.61.0"])("only covers reviewed sleep workflow identities (%s)") copies or separates ...run("sleep", "executeSleepTool", "root"); ...sleep while preserving existing object ownership; mutating source objects is not equivalent.
 */
it.each(["0.52.2", "0.61.0"])(
  "only covers reviewed sleep workflow identities (%s)",
  (version) => {
    const sleep = {
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
        { ...sleep, workflowName: "workflow//eve@0.53.0//executeSleepTool" },
      ]).unresolvedRunIds
    ).toEqual(["sleep"]);
  }
);
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("handles deep families without recursive stack growth") uses 10_000, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("handles deep families without recursive stack growth", () => {
  const runs = [run("0", "workflowEntry")];
  for (let index = 1; index < 10_000; index += 1) {
    runs.push(run(String(index), "turnWorkflow", String(index - 1)));
  }
  expect(classifyEveSandboxRuns(runs).unresolvedRunIds).toEqual([]);
});
/* oxlint-enable no-magic-numbers */
