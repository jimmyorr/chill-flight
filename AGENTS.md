## Git & workflow rules

- **Manual commits only**: Do not create git commits automatically. When a task or skill (including TDD or subagent workflows) reaches a commit point, you must stop, stage the changes, and ask for explicit permission before committing.
- **No standing permission**: A previous approval to commit (e.g., "go ahead and commit") applies ONLY to the currently staged changes. It does NOT grant permission for any future commits.
- **NEVER CHAIN COMMITS**: If you complete a follow-up task, you must ask for permission AGAIN before committing. Do not assume "go ahead and commit" means "commit everything I do from now on."
- **Verification first**: Always run the complete verification sequence (`npm run format && npm test`) before asking to commit, but do not proceed to the `git commit` command yourself.
- **Format before staging**: Always run the project's code formatter (`npm run format`) on modified files before verifying or staging changes. This ensures formatting remains consistent and prevents stylistic changes from being mixed into functional commits.
- **Isolated production commits**: Keep updates to the production build (files under the `docs/` directory) completely isolated in their own commits, separate from dev source code changes.
  - **No automatic production builds**: Never generate a production build (`npm run build` or updating the `docs/` folder) unless the USER explicitly requests it.
  - Making regular source changes (e.g., editing `game.js` or `index.html`) should be committed in small, clean, source-only commits first.
  - Generating a production build should be treated as an intentional, independent step only executed upon direct USER request.
  - **Exception**: You should bundle the version bump (updating `package.json` and `package-lock.json`), mobile project version syncs (iOS and Android), and `RELEASE_NOTES.md` in the same commit as the production build, as generating a new build corresponds with a version release.

## Server & verification rules

- **Use existing server**: Do not start a local development server (e.g., `npx serve`, `npm run dev`). A Live Server is already running on port 5173. Use `http://localhost:5173` for all browser-based verification. Avoid browser-based verification unless it is absolutely necessary.

## UI & typography rules

- **Sentence case only**: Always use "Sentence case" instead of "Title Case" for UI text, labels, buttons, and titles, as well as titles and headers in all documentation (such as the README). Strings that are intended to be ALL CAPS should remain so.

## Geometry & model rules

- **Debug page update**: When adding a new geometry or model to the game, always add it to the model debug page (`debug-models.html`) as well, so it can be previewed.

## Directory rules

- **Do not touch the docs directory**: The `docs/` directory is strictly for compiled production builds generated automatically by Vite. Never edit, search, or read files inside the `docs/` directory. All development, changes, and queries must be executed against the root source files (like `game.js`, `airplane.js`, `style.css`, root `index.html`, root `debug.html`, etc.).

## Location reporting rules

- **Always report locations in both units and lat/long**: Whenever identifying, referencing, or reporting a landmark, biome boundary, or coordinates in the game world, always specify the location in both in-game coordinate units (e.g., `X = -3000`, `Z = 5000`) and latitude/longitude format (e.g., `0.6 West`, `1.0 South`).

## Release workflow & release notes

- **End-to-end release workflow**: Whenever the user asks to prepare, cut, create, or publish a release (using any phrasing such as "cut a release", "release", "make a release", "let's release", "bump version and release", etc.), execute the full end-to-end release process in one cohesive turn:
  1. **Ensure clean source state**: Verify that any prior source code changes (e.g., `game.js`, `style.css`) have already been committed so the working tree has no uncommitted source changes.
  2. **Run release command**: Execute `npm run release` synchronously (which bumps the patch version, runs `scripts/sync-version.js` for mobile project versioning, and builds production assets into `docs/`).
  3. **Generate release notes**: Review the git commit history since the previous version bump and write concise release notes directly to the top of `RELEASE_NOTES.md`.
  4. **Format & verify**: Run `npm run format` and `npm run test:syntax`.
  5. **Stage release bundle**: Stage the release files (`package.json`, `package-lock.json`, mobile project files, `RELEASE_NOTES.md`, and `docs/`).
  6. **Ask for commit approval**: Propose the release commit message (e.g., `Release vX.Y.Z`) and wait for explicit user permission before committing.
- **Stand-alone release notes request**: If the user specifically asks only to update or generate release notes (e.g., "generate release notes"), review commit history since the last bump, append the entry to the top of `RELEASE_NOTES.md`, format, stage, and ask for permission to commit.
- **Length limit**: Each version entry in `RELEASE_NOTES.md` MUST be kept concise and explicitly limited to a maximum of **500 characters** per entry.
- **Formatting**: Use sentence case for bullet points and headers. Group changes into bolded categories (e.g., `* **Controls:** Added ...`).

## Documentation rules

- **Keep README up to date**: Whenever modifying, adding, or adjusting game features, controls, graphics presets, mechanics, or URL parameters, always ensure the corresponding documentation and tables in `README.md` are updated to reflect the changes.

## Communication rules

- **No background task announcements**: To avoid sending separate, unprompted chat messages that bury important context, **never** run short commands like `npm run format` or `git add` asynchronously. Always set `WaitMsBeforeAsync` to a high value (e.g., `5000` or `10000`) for these tools so they complete synchronously within your turn. You can then provide a single, comprehensive response to the user.

## ESLint & refactoring rules

- **Zero lint warnings standard**: The codebase maintains a strict zero-warning policy enforced by `npm run lint` (`eslint . --max-warnings=0`). Never propose or stage commits that introduce ESLint warnings or errors. Always run `npm run lint` or `npm test` as part of your verification pass before asking for commit approval.
- **Strict refactoring verification**: When refactoring code, extracting functions, or changing variable scope, you MUST run ESLint with the `no-undef` and `no-use-before-define` rules explicitly elevated to errors (e.g., `npx eslint <file> --rule 'no-undef: error' --rule 'no-use-before-define: error' --quiet`) to ensure no variables were broken. The default repository configuration treats these as warnings, meaning they can easily be missed in the output without the `--quiet` flag and explicit error elevation.
- **Code hygiene best practices**:
  - Use optional catch binding (`try { ... } catch { ... }`) when the error object is unused, rather than `catch (e)`.
  - Remove dead or leftover variables immediately during refactoring rather than leaving unused declarations.
  - Do not leave unused function arguments or destructured variables from imports or constants.

## Logging & console rules

- **Use the log utility**: Avoid raw `console.log` calls in runtime game code. Use the global `log` utility methods (`log.info`, `log.warn`, `log.error`) provided by `logger.js`.
- **Gate diagnostic output**: Use `log.info` for operational milestones, subsystem initialization (e.g., landmark placement, minimap loading, weather transitions, audio caching), and debug events. These logs are automatically suppressed by default and only print when debug mode is active (`?debug=1`, `localStorage.getItem('debug') === 'true'`, or `window.DEBUG = true`).
- **Preserve warnings and errors**: Use `log.warn` and `log.error` for genuine warnings, recoverable failures, or unexpected conditions. These always output to the console so Sentry and developers can catch issues.
- **Single startup banner**: Only the main entry file (`src/main.js`) prints a single, unguarded startup banner displaying the game title, version, and commit hash. Do not add other unguarded console outputs on startup.
- **Zero logging in hot paths**: Never place log statements (even `log.info`) inside frame animation loops, physics updates, chunk generation passes, or procedural elevation sampling.
