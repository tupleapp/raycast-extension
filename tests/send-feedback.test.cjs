const test = require("node:test");
const assert = require("node:assert/strict");
const createLoader = require("./load-typescript.cjs");

const Form = Object.assign(() => null, { TextArea: () => null, Description: () => null, Separator: () => null });
const Action = { SubmitForm: () => null };

function harness(send = async () => {}) {
  const slots = [];
  const calls = [];
  const toasts = [];
  let index = 0;
  let focused = 0;
  const load = createLoader(undefined, {
    "@raycast/api": {
      Form, Action, ActionPanel: () => null, Icon: { Message: "message" },
      Toast: { Style: { Animated: "animated", Failure: "failure", Success: "success" } },
      showToast: async (options) => { const toast = { ...options }; toasts.push(toast); return toast; },
    },
    react: {
      useState(initial) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = initial;
        return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
      },
      useRef(initial) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = { current: initial === null ? { focus: () => focused++ } : initial };
        return slots[slot];
      },
    },
    "./lib/feedback": {
      ...createLoader()("src/lib/feedback.ts"),
      sendFeedback: async (message) => { calls.push(message); await send(message); },
    },
  });
  const Component = load("src/send-feedback.tsx").default;
  function render() { index = 0; return Component(); }
  function field() { return render().props.children.find((child) => child?.type === Form.TextArea); }
  function submit() { return render().props.actions.props.children.props.onSubmit({ message: field().props.value }); }
  return { render, field, submit, calls, toasts, focused: () => focused };
}

test("opening and editing the form never sends feedback, and privacy information is visible", () => {
  const h = harness();
  const form = h.render();
  assert.equal(form.type, Form);
  assert.equal(form.props.navigationTitle, "Send Feedback");
  assert.notEqual(form.props.enableDrafts, true);
  assert.equal(h.field().props.autoFocus, true);
  const copy = form.props.children.filter(Boolean).map((child) => child.props.text ?? "").join(" ");
  assert.equal(copy.trim(), "Includes your Tuple account and app details.");
  const descriptions = form.props.children.filter((child) => child?.type === Form.Description);
  assert.equal(descriptions.length, 1);
  assert.doesNotMatch(copy, /bytes|4,000|Almost at the limit/);
  assert.equal(form.props.actions.props.children.props.title, "Send Feedback");
  h.field().props.onChange("An idea");
  assert.equal(h.field().props.value, "An idea");
  assert.deepEqual(h.calls, []);
});

test("length feedback stays quiet until near the limit and uses plain-language errors", () => {
  const h = harness();
  const descriptions = () => h.render().props.children.filter((child) => child?.type === Form.Description).map((child) => child.props.text).join(" ");
  h.field().props.onChange("x".repeat(3599));
  assert.doesNotMatch(descriptions(), /Almost at the limit/);
  h.field().props.onChange("🙂".repeat(900));
  assert.match(descriptions(), /Almost at the limit/);
  h.field().props.onChange("🙂".repeat(1001));
  assert.match(h.field().props.error, /Please shorten your feedback/);
  assert.doesNotMatch(descriptions(), /Almost at the limit|bytes|4,000/);
  h.field().props.onChange("A shorter idea");
  assert.equal(h.field().props.error, undefined);
  assert.doesNotMatch(descriptions(), /Almost at the limit/);
  assert.deepEqual(h.calls, []);
});

test("invalid submissions focus the feedback field and make no request", async () => {
  const h = harness();
  assert.equal(await h.submit(), false);
  assert.match(h.field().props.error, /Enter/);
  h.field().props.onChange("🙂".repeat(1001));
  assert.equal(await h.submit(), false);
  assert.match(h.field().props.error, /Please shorten your feedback/);
  assert.equal(h.focused(), 2);
  assert.equal(h.toasts.length, 0);
  assert.deepEqual(h.calls, []);
});

test("an explicit submission is single-flight, stays open, and clears only after success", async () => {
  let complete;
  const h = harness(() => new Promise((resolve) => { complete = resolve; }));
  h.field().props.onChange("Please improve this");
  const pending = h.submit();
  await Promise.resolve();
  assert.equal(h.render().props.isLoading, true);
  assert.equal(await h.submit(), false);
  assert.equal(h.field().props.value, "Please improve this");
  complete();
  await pending;
  assert.deepEqual(h.calls, ["Please improve this"]);
  assert.equal(h.field().props.value, "");
  assert.equal(h.toasts[0].style, "success");
  assert.equal(h.toasts[0].title, "Feedback Submitted");
  assert.equal(h.render().props.isLoading, false);
});

test("edits made during submission are not erased when the earlier message succeeds", async () => {
  let complete;
  const h = harness(() => new Promise((resolve) => { complete = resolve; }));
  h.field().props.onChange("First message");
  const pending = h.submit();
  await Promise.resolve();
  h.field().props.onChange("Another thought");
  complete();
  await pending;
  assert.equal(h.field().props.value, "Another thought");
});

test("failed submissions preserve text, do not expose raw errors, and allow explicit retry", async () => {
  const secret = "Private feedback text";
  let fail = true;
  const h = harness(async () => { if (fail) throw new Error(`Command failed: tuple feedback ${secret}`); });
  h.field().props.onChange(secret);
  assert.equal(await h.submit(), false);
  assert.equal(h.field().props.value, secret);
  assert.equal(h.toasts[0].style, "failure");
  assert.doesNotMatch(h.toasts[0].message, /Private feedback text/);
  assert.equal(h.render().props.isLoading, false);
  fail = false;
  await h.submit();
  assert.equal(h.calls.length, 2);
  assert.equal(h.field().props.value, "");
});
