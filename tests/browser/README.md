# Feedback browser harness

This harness runs the repository's **actual** `src/send-feedback.tsx`,
`src/lib/feedback.ts`, and error types. It replaces Raycast's native UI with
browser adapters and replaces the CLI boundary with an in-memory fake. It does
not import the production Tuple transport, spawn processes, or send feedback.
Use synthetic sample messages only.

## Generate an interactive Canvas preview

```sh
npm run preview:feedback -- --output /tmp/feedback-preview.jsx
```

The output is a standalone React module that can be loaded into Inspect Canvas.
In Inspect, `node scripts/build-feedback-preview.cjs --canvas` emits the JSON
arguments for `canvas_create_app` (use its `l_input_from_bash` parameter).
Rebuild and update the Canvas app after changes to the command, validation, or
adapter. A source fingerprint in the preview identifies its source snapshot.
The generator allows only the known imports; unknown modules fail closed.

The generated file is a test artifact, not an extension entry point. No browser
adapter or fake CLI is included in the published Raycast commands.

## Checks

```sh
NODE_NO_WARNINGS=1 node --test tests/feedback-preview.test.cjs tests/feedback.test.cjs tests/send-feedback.test.cjs
```

`NODE_NO_WARNINGS=1` prevents the Inspect sandbox's injected Node proxy warnings
from contaminating the fake executable's JSON stderr in CLI regression tests.

In the interactive preview, use **Close and reopen command** between scenarios
to reset the call counts. Reset and response controls are disabled for all
in-flight requests (both normal simulated latency and explicitly paused sends).

1. Submit an empty form. Expect an inline validation error and zero CLI calls.
2. Enter 1,001 `🙂` emoji. Expect 4,004 bytes, a limit error, and zero submissions.
3. Choose **Signed out**, enter sample feedback, and submit. Expect sign-in
   guidance, retained text, one support check, and one failed fake submission.
4. Choose **Success** and check **Pause feedback response**. Submit, submit
   again, and verify the count stays at one. Release the response. Expect success
   and cleared submitted text. If you edit while paused, the newer text stays.
5. Choose **Unsupported CLI**. Submit valid text. Expect update guidance and a
   read-only help check, with no feedback submission.
6. **Close and reopen command** discards unsent text. This resets the harness's
   component instance; it is not an assertion about Raycast's window lifecycle.

The boundary log exposes the exact synthetic argv, including `--` before the
message. The response selector also covers unavailable feedback and unknown
outcomes. No request is retried automatically.

## What this proves—and does not

Real browser interaction exercises the actual component's React state,
validation, submit handler, duplicate prevention, error mapping, and draft
handling against controlled CLI outcomes. Unit tests additionally verify that
the generated module parses, loads only React externally, and excludes the
production transport.

The adapters approximate Raycast controls, toasts, focus refs, form-error gating,
and a submit keyboard shortcut. They do **not** prove native typography, geometry,
keyboard behavior, window lifecycle, CLI authorization, live delivery, or
analytics receipt. Browser screenshots and recordings must be labeled as
harness evidence, never native Raycast screenshots.
