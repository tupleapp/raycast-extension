const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tuple-feedback-test-"));
const binary = path.join(scratch, "tuple");
const log = path.join(scratch, "args.jsonl");
const load = require("./load-typescript.cjs")(binary);
const { sendFeedback, feedbackValidationError, feedbackByteLength, feedbackLengthWarning, feedbackErrorMessage } = load("src/lib/feedback.ts");
const { TupleError, TupleErrorKind } = load("src/lib/types.ts");
const help = "Usage:\n  tuple feedback <message> [flags]\n";

function fake(body) {
  fs.writeFileSync(log, "");
  fs.writeFileSync(binary, `#!${process.execPath}\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nfs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args)+'\\n');\n${body}`, { mode: 0o700 });
}
function calls() {
  return fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}
function supported(body = "") {
  fake(`if (args[0] === 'feedback' && args[1] === '--help') process.stdout.write(${JSON.stringify(help)}); else { ${body} }`);
}
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));

test("feedback validation matches the 4000-byte limit without truncation", () => {
  for (const message of ["", " \t\r\n", "\u00a0"]) assert.match(feedbackValidationError(message), /Enter/);
  assert.equal(feedbackByteLength("  hello \n"), 5);
  assert.equal(feedbackLengthWarning("x".repeat(3599)), undefined);
  assert.equal(feedbackLengthWarning("x".repeat(3600)), "Almost at the limit.");
  assert.equal(feedbackLengthWarning("🙂".repeat(900)), "Almost at the limit.");
  assert.equal(feedbackLengthWarning("x".repeat(4000)), "Almost at the limit.");
  assert.equal(feedbackLengthWarning("x".repeat(4001)), undefined);
  assert.equal(feedbackValidationError("x".repeat(4000)), undefined);
  assert.equal(feedbackValidationError("🙂".repeat(1000)), undefined);
  assert.match(feedbackValidationError("🙂".repeat(1000) + "x"), /shorten/);
  assert.match(feedbackValidationError("x".repeat(4001)), /shorten/);
  assert.match(feedbackValidationError("a\0b"), /null/);
});

test("invalid input never starts the CLI", async () => {
  fake("");
  for (const message of [" \n", "🙂".repeat(1001), "a\0b"]) await assert.rejects(sendFeedback(message));
  assert.deepEqual(calls(), []);
});

test("sending uses one literal argv message after -- and accepts empty stdout plus success stderr", async () => {
  supported(`process.stderr.write('Feedback sent to the Tuple team\\n');`);
  const message = '--help\n"quoted" $(not-a-shell) 🎉';
  await sendFeedback(` \n${message}\n `);
  assert.deepEqual(calls(), [
    ["feedback", "--help"],
    ["--format", "json", "feedback", "--", message],
  ]);
});

test("old CLIs and unrelated help never send, even when help exits successfully", async () => {
  for (const output of ["", "Usage: tuple [command]", "Available Commands:\n feedback"]) {
    fake(`process.stdout.write(${JSON.stringify(output)});`);
    await assert.rejects(sendFeedback("An idea"), (error) => error.kind === TupleErrorKind.CapabilityUnavailable);
    assert.deepEqual(calls(), [["feedback", "--help"]]);
  }
  fake(`process.stderr.write('{"error":"unknown command feedback"}'); process.exitCode=1;`);
  await assert.rejects(sendFeedback("An idea"), /Update Tuple/);
  assert.equal(calls().length, 1);
});

test("canonical failures get actionable copy without raw message or process arguments", async () => {
  for (const [payload, expected] of [
    [{ kind: "unauthorized", error_code: 401 }, /sign in.*allow CLI access/],
    [{ error_code: 401 }, /sign in/],
    [{ kind: "sign_in_pending", error_code: 503 }, /sign in/],
    [{ kind: "feedback_unavailable", error_code: 503 }, /try again later/],
    [{ error_code: 404 }, /3\.4\.3/],
    [{ kind: "daemon_down" }, /Open Tuple/],
    [{ error_code: 500 }, /Check before resending/],
  ]) {
    supported(`process.stderr.write(${JSON.stringify(JSON.stringify({ ...payload, error: "private message echoed" }))}); process.exitCode=1;`);
    await assert.rejects(sendFeedback("private message"), (error) => {
      const copy = feedbackErrorMessage(error);
      assert.match(copy, expected, JSON.stringify({ kind: error.kind, cliKind: error.cliKind, status: error.status, detail: error.detail }));
      assert.doesNotMatch(copy, /private message/);
      return true;
    });
    assert.equal(calls().length, 2, "failures are never retried automatically");
  }
});

test("missing executables and unstructured failures remain safe and useful", async () => {
  fs.rmSync(binary, { force: true });
  await assert.rejects(sendFeedback("An idea"), (error) => {
    assert.match(feedbackErrorMessage(error), /Install Tuple.*CLI Path/);
    return true;
  });
  supported(`process.stderr.write('private feedback on stderr'); process.exitCode=1;`);
  await assert.rejects(sendFeedback("private feedback"), (error) => {
    assert.match(feedbackErrorMessage(error), /Check before resending/);
    assert.doesNotMatch(feedbackErrorMessage(error), /private feedback/);
    return true;
  });
  assert.match(feedbackErrorMessage(new TupleError(TupleErrorKind.Unknown, "timeout")), /avoid duplicates/);
});
