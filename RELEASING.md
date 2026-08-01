# Release Guide

`deno.jsonc` is the only source of truth for the package version. Release tags must use a `v` prefix; for example,
version `2.0.0` uses tag `v2.0.0`.

## Prepare

1. Work from the intended release commit on `master` with a clean worktree.
2. Update `version` in `deno.jsonc`. For a major release, also update the breaking-change and migration documentation.
3. Run the release gates:

   ```sh
   deno task fmt
   deno task lint
   deno task check
   deno task test
   deno task verify:version v2.0.0
   deno publish --dry-run
   ```

4. Review the dry-run file list and commit the release preparation.

## Publish

Create a GitHub Release whose `v`-prefixed tag matches the version in `deno.jsonc`. Publishing it triggers
`.github/workflows/publish.yml`, which checks out that tag, repeats every release gate, verifies the version, and then
publishes to JSR.

The JSR package must be linked to `deno-torrent/torrent-dht` in its JSR settings before the first automated publish.
GitHub Actions authenticates with OIDC using `id-token: write`; do not create or store a long-lived JSR token.

If any gate fails, fix the issue in a new commit and create a new version and Release tag. Published JSR versions are
immutable; do not move or rewrite a published tag.
