import { expect, it } from "vitest";

import { classifyEveSandboxRuns } from "./eve-sandbox-run-coverage";

function run(
  id: string,
  kind: string,
  parentId: string | null = null,
  eveParentId: string | null = null
) {
  return { id, workflowName: `workflow//eve//${kind}`, parentId, eveParentId };
}
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
it("only covers the pinned sleep workflow identity", () => {
  const sleep = {
    ...run("sleep", "executeSleepTool", "root"),
    workflowName: "workflow//eve@0.52.2//executeSleepTool",
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
});
it("handles deep families without recursive stack growth", () => {
  const runs = [run("0", "workflowEntry")];
  for (let index = 1; index < 10_000; index++) {
    runs.push(run(String(index), "turnWorkflow", String(index - 1)));
  }
  expect(classifyEveSandboxRuns(runs).unresolvedRunIds).toEqual([]);
});
