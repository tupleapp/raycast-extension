# Publishing workflow

`tupleapp/raycast-extension` is our source repository. Its `main` branch tracks
the extension published from `raycast/extensions/extensions/tuple`, with a
temporary lead while an upstream submission is pending. Merging locally
records our intent to publish. Repository-only instructions such as this file
stay in our repository.

1. Before preparing a release, inspect both repositories' PRs and compare our
   `main` with the published extension. Reconcile upstream fixes and resolved
   changelog dates into our repository before starting another submission.
2. Validate the release and merge its PR into our remote `main` before opening
   or updating the upstream publishing PR. Submit the merged extension files
   from a clean checkout of that commit. Keep repository-only files out of the
   upstream extension directory.
3. Link the local PR, upstream PR, and related Linear issue. Record the submitted
   local commit and distinguish submitted, merged upstream, and published.
4. For upstream review changes, commit and merge the corresponding changes in
   our repository before updating the upstream PR. If a maintainer changes the
   upstream branch directly, bring those changes back into our `main`.
5. After upstream merge, verify the Store publication confirmation, sync the
   final published files (including the resolved changelog date) into our
   `main`, and compare every extension file against the upstream merge commit.
   Finish when the extension files match, our release PRs are merged, and the
   Linear issue records the publication link and completed status. If review or
   publication is pending, leave the issue open with the upstream link and
   remaining step.
