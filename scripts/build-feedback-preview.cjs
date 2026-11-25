const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const inputs = {
  command: ["src/send-feedback.tsx", ["@raycast/api", "react", "./lib/feedback"]],
  feedback: ["src/lib/feedback.ts", ["./tuple", "./types"]],
  types: ["src/lib/types.ts", []],
  preview: ["tests/browser/feedback-preview.jsx", ["react"]],
};

function buildPreview() {
  const hash = crypto.createHash("sha256");
  const factories = Object.entries(inputs).map(([name, [filename, imports]]) => {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    for (const dependency of ts.preProcessFile(source).importedFiles) {
      if (!imports.includes(dependency.fileName))
        throw new Error(`Preview dependency not allowed: ${filename}: ${dependency.fileName}`);
    }
    hash.update(filename).update(source);
    const compiled = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText;
    return `${JSON.stringify(name)}: function(module, exports, require, Buffer) {\n${compiled}\n}`;
  });
  const fingerprint = hash.digest("hex").slice(0, 12);
  return `import * as React from "react";
// Generated from the repository sources. Do not hand-edit the command or validation here.
const factories = { ${factories.join(",\n")} };
const sourceVersion = ${JSON.stringify(fingerprint)};
function createRuntime() {
  const cache = new Map();
  let api;
  let tuple;
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    if (!Object.hasOwn(factories, name)) throw new Error("Preview module not allowed: " + name);
    const module = { exports: {} };
    cache.set(name, module);
    const require = (id) => {
      if (id === "react") return React;
      if (id === "@raycast/api") return api;
      if (id === "./tuple") return tuple;
      if (id === "./types") return load("types");
      if (id === "./lib/feedback") return load("feedback");
      throw new Error("Preview import not allowed: " + id);
    };
    factories[name](module, module.exports, require, { byteLength: (value) => new TextEncoder().encode(value).length });
    return module.exports;
  }
  const { createPreview } = load("preview");
  return createPreview((browserApi, fakeTuple) => {
    api = browserApi;
    tuple = fakeTuple;
    return load("command").default;
  }, load("types"), sourceVersion);
}
export default function FeedbackHarness() {
  const Preview = React.useMemo(createRuntime, []);
  return React.createElement(Preview);
}
`;
}

module.exports = { buildPreview };
if (require.main === module) {
  const code = buildPreview();
  const [flag, output] = process.argv.slice(2);
  if (flag === "--canvas") {
    process.stdout.write(
      JSON.stringify({
        name: "Tuple feedback functional harness",
        type: "page",
        width: 1240,
        height: 960,
        code,
        suggestions: [],
      }),
    );
  } else if (flag === "--output" && output) {
    fs.writeFileSync(output, code);
    process.stdout.write(`Generated ${output}\n`);
  } else if (!flag) {
    process.stdout.write(code);
  } else {
    throw new Error("Usage: node scripts/build-feedback-preview.cjs [--canvas | --output path.jsx]");
  }
}
