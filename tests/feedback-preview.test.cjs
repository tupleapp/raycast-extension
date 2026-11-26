const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { buildPreview } = require("../scripts/build-feedback-preview.cjs");

function loadPreview() {
  const code = buildPreview();
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const imports = [];
  const context = vm.createContext({
    module,
    exports: module.exports,
    TextEncoder,
    setTimeout,
    FormData,
    require(id) {
      imports.push(id);
      assert.equal(id, "react", "generated harness must not load Node, Raycast, or production CLI modules");
      return { ...React, useMemo: (create) => create() };
    },
  });
  new vm.Script(compiled, { filename: "generated-feedback-preview.cjs" }).runInContext(context);
  return { code, imports, render: module.exports.default };
}

test("generated preview parses and initializes the actual-source runtime with only React imported", () => {
  const { imports, render } = loadPreview();
  const root = render();
  assert.equal(typeof root.type, "function");
  assert.deepEqual(imports, ["react"]);
});

test("harness controls stay locked during normal and paused in-flight requests", () => {
  const { hasPendingRequests } = require("./load-typescript.cjs")()("tests/browser/feedback-preview.jsx");
  assert.equal(hasPendingRequests([]), false);
  assert.equal(hasPendingRequests([{ status: "Pending", help: false }]), true);
  assert.equal(hasPendingRequests([{ status: "Read only" }, { status: "Pending", help: false }]), true);
  assert.equal(hasPendingRequests([{ status: "Accepted by fake CLI" }]), false);
});

test("preview is deterministic, includes the real submission contract, and excludes the production transport", () => {
  const { code } = loadPreview();
  assert.equal(code, buildPreview());
  assert.match(code, /sourceVersion = "[a-f0-9]{12}"/);
  assert.match(code, /function SendFeedback\(/);
  assert.match(code, /function feedbackValidationError\(/);
  assert.ok(code.includes('("feedback", "--", message.trim())'), "actual feedback argv must be included");
  assert.doesNotMatch(code, /node:child_process|execFileAsync|SharedSupport\/bin\/tuple|https?:\/\//);
  assert.match(code, /Preview import not allowed/);
});
