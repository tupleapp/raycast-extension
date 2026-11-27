# Source-backed feedback browser preview

Run `npm ci` if dependencies are absent, then `npm run preview:feedback -- --output /tmp/feedback-preview.jsx`.
The generated standalone React module imports the actual command, validation, and error types. It replaces Raycast controls with fixed browser adapters and Tuple transport with an in-memory fake. No production transport or feedback delivery is available.

`node scripts/build-feedback-preview.cjs --canvas` emits Canvas app arguments. Rebuild after every source change; the preview displays a source fingerprint. Keep the generator and adapters unchanged so previews remain comparable.

## Functional checks

Run `NODE_NO_WARNINGS=1 node --test tests/feedback-preview.test.cjs tests/feedback.test.cjs tests/send-feedback.test.cjs`.
The environment flag keeps injected Node proxy warnings out of fake CLI JSON stderr. Tests use fake executables, never Tuple.

In the browser, use synthetic text only:

1. Open the clean form. Opening and editing produce zero CLI calls.
2. Submit blank text and then 1,001 `🙂` emoji. Both reject without submitting. The limit is 4,000 UTF-8 bytes after trimming; valid input is never silently truncated.
3. Choose Signed out, enter sample feedback, and submit. The error preserves the draft and permits explicit recovery.
4. Choose Success and Pause feedback response. Submit twice. Only one fake feedback submission occurs. Release the response to observe local acceptance. New text typed during the pending request remains after acceptance.
5. Choose Unsupported CLI and submit valid text. A read-only capability check occurs but no feedback submission.
6. Inspect the boundary log for one literal message argument after `--`. The unknown-outcome response must preserve the draft without claiming confirmed delivery or retrying automatically.
7. Close and reopen command resets the harness instance and call log. This does not establish native Raycast draft/window behavior.

## Evidence limits

The preview exercises real component state, validation, submission, and error mapping. Fixed browser controls approximate native Raycast layout, focus, toasts, and keyboard behavior. Screenshots establish browser-harness behavior only, not native geometry, accessibility, CLI authorization, analytics receipt, or end-to-end delivery.
