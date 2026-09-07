# Canonical CLI migration validation

Authority: [TUP-4242](https://linear.app/tuple/issue/TUP-4242/migrate-the-raycast-extension-to-the-canonical-cli)
and the full ticket relations fetched on 2026-09-07. CLI source was inspected read-only
from `tupleapp/app` master `7bd11a0b2307ba4d3416d457a866131605fc3655`.

## Prior work reconciled

The isolated migration branch started at `ba0420e`. The clean main checkout remains
on `codex/preserve-compact-transcript-timestamps` at `76196a4`.
The migration explicitly cherry-picked `293ae75`, `5bd63fc`, `d218d51`, `4378748`,
`1c3d148`, `cf39e1a`, `15c390d`, and `3fcae18`: guarded contacts, CLI updates,
dependency overrides, room fixes, and compact timestamps. Contribution commit
`827fd76` was already represented after changelog conflict resolution and skipped
as empty. Merge commits were not copied. The resulting tree matched `76196a4`
exactly before migration edits. No existing canonical migration PR or Raycast bb
thread was found; only dependency PR #1 was open.

## Extension contract

- `contacts` and `rooms` retain their plural roots and guarded actions.
- Call metadata uses `call show [call]`; actions use `call participants add|remove`,
  `call leave`, and `call edit`. Mandatory wait and switch flags never retry without flags.
- The bounded canonical `state` summary supplies local mute/Capture state and an
  explicit idle result. `call show <id>` checks the active call's canonical identity
  and lifecycle. The extension never reads `state --raw` or joins full collections.
- `capture list` is bounded; participant filtering is applied by the store before
  its limit. Search preserves multiple occurrences per call and passes input intact,
  including punctuation and leading hyphens after `--`. The bounded recent-call
  page supplies optional group titles, never filters out older search hits.
- `capture show --format json` is NDJSON. Complete records reach AI tools unchanged;
  human views render every category with local clock timestamps. Retained metadata
  is fetched separately with `call show`, including for older search hits.
- `capture export <file>` writes a complete JSONL artifact by default. Explicit
  transcript-only selection uses `--exclude events,content`. The preference remains
  a folder; the extension constructs a distinct artifact filename within it.
- `capture delete` removes the complete stored Capture, including events, content,
  and retained media. Confirmation describes that scope.
- `connect prompt --format json [--call <id>]` returns plain prompt text on stdout
  and structured errors on stderr. It never launches a harness. AI summaries and
  `read-capture` consume the actual CLI guide rather than embedding a copied guide.
- Existing stored data stays owned by Tuple. No extension data migration runs.

## Release decision and blockers

Use one minimum supported Tuple release and one vocabulary. There is no old-CLI
adapter, optional-flag retry, stdout-error parser, or English-error classifier.
The release number is deliberately unset until an actual published Tuple build
passes validation. This draft is not ready for Raycast publication.

Observed core state on 2026-09-07:

1. [#4059](https://github.com/tupleapp/app/pull/4059), capability state, is merged.
2. [#4061](https://github.com/tupleapp/app/pull/4061), session identity, is open.
   The extension does not invent session identifiers or alter that branch.
3. [TUP-4287](https://linear.app/tuple/issue/TUP-4287/unify-attached-and-managed-agent-participation-guidance)
   remains planned. Final version-matched guide validation is downstream of it.
4. Literal occurrence search is not implemented by inspected master:
   `cli/cmd/transcription/search.go` documents FTS5 operators, and
   `cli/api/ftsquery.go` preserves OR/NOT and quoted phrases. Raycast passes literal
   input without quoting, but the end-to-end literal guarantee requires a core
   change. No guessed `--literal` or expert-mode flag is sent.
5. Some canonical failures lack machine discriminators. `call show` rewrites
   missing-current to an untyped error; socket failures have no stable kind;
   the Capture store returns HTTP 503 without a kind, which cannot distinguish
   an uninitialized store from a service failure. Idle UI is preserved through
   structured `state`, while untyped failures remain visible generic errors.
   Restoring the dedicated daemon-down and first-Capture empty states requires
   core-owned discriminators; English text is not parsed.
6. [#3934](https://github.com/tupleapp/app/pull/3934), TUP-4206 store-owned discovery,
   is open and not in inspected master. The occurrence UI does not need a call-level query;
   any future one-row-per-call search must use that contract, never an unbounded join.

Before release: verify the published canonical CLI and matching app, set and test
its real minimum version, then run one live-call Raycast smoke (contacts, rooms,
join/add, mute, Capture toggle, context, leave) and one stored-call smoke (older
search result, complete detail, metadata, both exports, confirmed deletion, AI).
Validate punctuation and OR/NOT as literal text, daemon-down/empty-store toasts,
and attached guide behavior against the final TUP-4287 guide. These live/release
checks remain blocked; fixture tests are not evidence that they passed.

## Verification evidence

- `npm test`: 13 focused tests exercise real child-process invocation, mandatory
  canonical paths, punctuation and argument boundaries, structured stderr versus
  stdout, no old-CLI retry, schema rejection, complete Capture categories, compact
  clocks, guide handoff, store filtering, guarded contacts, and active-call races.
- `TUPLE_CANONICAL_CLI=/path/to/tuple npm run test:canonical`: three integration
  tests run the extension wrappers against the actual Go CLI and a fixture daemon
  over a Unix socket. They verify complete NDJSON plus canonical Call metadata,
  lossless complete and transcript-only export artifacts, and composed store filters.
  Run with a canonical CLI built from the intended release source; the test requires
  an explicit binary and never silently skips. The fixture has no real calls or user data.
- Inspected master was archived under `/tmp/tup4242-core` without modifying the core
  checkout. Its CLI was built as `/tmp/tup4242-canonical-cli` for the integration run.
  `go test ./cmd/transcription ./capture/artifact ./output` passed. Connect tests
  passed with `TMPDIR=/tmp go test ./cmd/connect`; the default macOS temp path
  exceeded Unix-socket length limits on the first run.
- `npm run build`, `npm run lint`, and `git diff --check` are required after final edits.
  Test fixtures do not validate Raycast's running UI or unreleased guide behavior.
