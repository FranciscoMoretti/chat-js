// Explicit high-risk obligations, not all pairs of arbitrary option names.
import assert from "node:assert/strict";
const required = [
  "identity:transport", "binding:execution", "tool:renderer", "approval:restart",
  "layout:view-state", "model:execution", "files:document-revision", "registry:source-omission",
  "registry:edited-composition", "full:coexistence",
];
const scenarios = [
  { id:"minimal-next", covers:["identity:transport","binding:execution","tool:renderer","approval:restart","model:execution"], evidence:"M07 recorded live evidence; not rerun here" },
  { id:"minimal-installed", covers:["registry:source-omission"], evidence:"M08 synthetic registry omission proof; actual M07 registry journey still needed" },
  { id:"external-swap", covers:["identity:transport","model:execution","tool:renderer"], evidence:"M08 actual M07 source typecheck + identity/schema unit conformance; live external model untested" },
  { id:"two-views", covers:["layout:view-state"], evidence:"UI acceptance scenario planned here; consume UI task evidence" },
  { id:"document-branch", covers:["files:document-revision","binding:execution"], evidence:"planned integrated production journey; private tree prototype is bounded evidence only" },
  { id:"add-edited", covers:["registry:edited-composition","tool:renderer"], evidence:"layout edit preservation spike passed; actual M07 add/registration journey still needed" },
  { id:"full-reference", covers:["full:coexistence", "layout:view-state", "files:document-revision"], evidence:"planned M31" },
];
function uncovered(rows: typeof scenarios) {
  const covered = new Set(rows.flatMap(row => row.covers));
  return required.filter(edge => !covered.has(edge));
}
assert.deepEqual(uncovered(scenarios), []);
assert.deepEqual(uncovered(scenarios.filter(row => row.id !== "full-reference")), ["full:coexistence"]);
// Select tests by changed semantic boundary, not by all app permutations.
const changedBoundary = "model";
const affected = scenarios.filter(row => row.covers.some(edge => edge.split(":").includes(changedBoundary)));
assert.deepEqual(affected.map(row => row.id), ["minimal-next", "external-swap"]);
console.log(JSON.stringify({scope:"Plan coverage only, NOT proof every scenario passed", required, scenarios, exampleImpact:{changedBoundary,selectedScenarios:affected.map(row=>row.id),always:"changed implementation conformance + generated representative typechecks"}}, null, 2));
