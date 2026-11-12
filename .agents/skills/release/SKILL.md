---
name: release
description: >-
  Prepares, verifies, tags, and deploys a new Chill Flight release across web
  (Cloudflare Pages and itch.io), iOS (TestFlight / App Store Connect), and
  Android (Google Play), or generates concise version entries in
  RELEASE_NOTES.md. Use this skill whenever the user asks to cut, prepare,
  create, or publish a release, bump the version, or write release notes.
---

# Cutting a release and writing release notes

## Platform requirement (macOS only)

Never run `npm run release` or `npm run release:tag` in a Linux/cloud container (`process.platform !== 'darwin'`). Cloud containers lack Xcode, the Android SDK, and deployment credentials (Cloudflare, itch.io, Google Play, App Store Connect), so bumping the version there pollutes `main` without deploying builds. If running on Linux, stop immediately and ask the user to run the release from macOS.

## End-to-end release workflow

Execute Steps 1 through 6 in one cohesive turn, pausing at Step 6 for explicit commit approval before running Step 7:

1. **Ensure clean source state**:
   - Confirm all prior source code changes (`game.js`, `style.css`, etc.) are already committed (`git status -s` must be clean; [scripts/check-clean-source.js](../../../scripts/check-clean-source.js) enforces this).
2. **Build the release bundle**:
   - Run `npm run release` synchronously. This bumps the patch version in `package.json` / `package-lock.json`, runs [scripts/sync-version.js](../../../scripts/sync-version.js) to sync iOS (`MARKETING_VERSION` + `CURRENT_PROJECT_VERSION`) and Android (`versionName` + `versionCode`), and compiles production assets into `docs/`.
3. **Write release notes**:
   - Inspect commits since the previous release tag (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`) and prepend the new version section to the top of [RELEASE_NOTES.md](../../../RELEASE_NOTES.md) following the formatting rules below.
4. **Format and verify**:
   - Run `npm run format && npm run test:emdash && npm run test:syntax`.
5. **Stage the release bundle**:
   - Stage `package.json`, `package-lock.json`, mobile version files (`ios/`, `android/`), `RELEASE_NOTES.md`, and `docs/`.
6. **Ask for explicit commit approval**:
   - Present the release notes entry, propose the commit message `Release vX.Y.Z`, note that it will be tagged `vX.Y.Z` and deployed, and wait for explicit user approval.
7. **Commit, tag, and deploy (after approval)**:
   - Commit the staged bundle: `git commit -m "Release vX.Y.Z"`.
   - Run `npm run release:tag` ([scripts/tag-release.js](../../../scripts/tag-release.js)), which creates the annotated tag `vX.Y.Z`, deploys web builds to Cloudflare Pages and itch.io, builds and uploads Android to Google Play and iOS to TestFlight / App Store Connect, pushes commits and tags to `origin main`, and prints the post-release summary banner.
   - Optional flags on `npm run release:tag -- <flags>` when explicitly requested by the user: `--web-only` (or `--skip-mobile`), `--skip-itch`, `--no-push`.

## Stand-alone release notes workflow

If the user asks only to generate or update release notes without cutting a build:

1. Review commit history since the last version bump.
2. Prepend the entry to [RELEASE_NOTES.md](../../../RELEASE_NOTES.md) following the rules below.
3. Run `npm run format && npm run test:emdash`, stage `RELEASE_NOTES.md`, and ask for permission to commit.

## `RELEASE_NOTES.md` formatting rules

- **Strict 500-character limit**: Each version entry MUST be `<= 500` characters total (verify with `wc -m` on the new section).
- **Header link**: Link the version number to its Cloudflare Pages preview URL, replacing dots with hyphens in the subdomain: `## [1.2.9](https://v1-2-9.chill-flight.pages.dev)`.
- **Grouped sentence-case bullets**: Group related changes into 2 to 4 bullets with bolded sentence-case category prefixes (e.g., `- **World & weather:** Added ...`, `- **Controls & fixes:** Tuned ...`).
- **No em dashes**: Never use Unicode em dashes or HTML mdash entities anywhere; use hyphens (`-`), colons (`:`), commas, or semicolons instead.
