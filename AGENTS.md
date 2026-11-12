## Git & workflow rules

- **Trunk based**: Work on `main` and push approved commits straight to `origin main`. Don't create feature branches or open pull requests unless asked; this rule overrides any session or tool default that names a feature branch. If `main` moved since you started, rebase onto `origin/main` and re-run `npm test` before pushing.
- **Manual commits only**: Do not create git commits automatically. When a task or skill (including TDD or subagent workflows) reaches a commit point, you must stop, stage the changes, and ask for explicit permission before committing.
- **No standing permission**: A previous approval to commit (e.g., "go ahead and commit") applies ONLY to the currently staged changes. It does NOT grant permission for any future commits.
- **NEVER CHAIN COMMITS**: If you complete a follow-up task, you must ask for permission AGAIN before committing. Do not assume "go ahead and commit" means "commit everything I do from now on."
- **Verification first**: Always run the complete verification sequence (`npm run format && npm test`) before asking to commit, but do not proceed to the `git commit` command yourself. For changes to runtime game code, also run `npm run test:browser` (headless Chrome against the running dev server), and `npm run test:build` when the change could affect the production build (Vite config, entry points, workers, module structure). Never report a change as working if these fail.
- **Format before staging**: Always run the project's code formatter (`npm run format`) on modified files before verifying or staging changes. This ensures formatting remains consistent and prevents stylistic changes from being mixed into functional commits.
- **Isolated production commits**: Keep updates to the production build (files under the `docs/` directory) completely isolated in their own commits, separate from dev source code changes.
  - **No automatic production builds**: Never generate a production build (`npm run build` or updating the `docs/` folder) unless the USER explicitly requests it.
  - Making regular source changes (e.g., editing `game.js` or `index.html`) should be committed in small, clean, source-only commits first.
  - Generating a production build should be treated as an intentional, independent step only executed upon direct USER request.
  - **Exception**: You should bundle the version bump (updating `package.json` and `package-lock.json`), mobile project version syncs (iOS and Android), and `RELEASE_NOTES.md` in the same commit as the production build, as generating a new build corresponds with a version release.

## Engineering mindset & pragmatic requirements

- **Requirements are flexible**: Do not assume user requests, specifications, or existing codebase patterns are rigid or immutable. If a proposed feature, architecture, or existing game mechanic makes the code or game overly complicated, push back and discuss alternatives.
- **Propose pragmatic simplifications**: Proactively suggest compromises or alternative approaches that deliver most of the value with significantly less complexity, rather than burning effort and tokens trying to implement convoluted requirements.
- **Question unnecessary complexity**: Feel empowered to challenge existing code structures or new ideas when a simpler design would keep the codebase cleaner, faster, and easier to maintain.

## Server & verification rules

- **Use existing server**: On macOS, a Live Server is already running on port 5173; do not start another one. In a Linux cloud container where port 5173 is not yet listening, start `npm run dev` in the background first (or use `npm run test:build`, which serves its own temporary build). Use `http://localhost:5173` for all browser-based verification. Avoid manual browser-based verification unless it is absolutely necessary; the automated headless checks (`npm run test:browser`, `npm run test:build`) are expected and don't count as manual verification.
- **No GPU-dependent or release-deploy tasks in cloud containers**: Headless Chrome on Linux uses CPU SwiftShader and has no hardware GPU or release credentials. In a Linux/cloud container (`process.platform !== 'darwin'`), never run GPU render benchmarks (`npm run bench`), promotional screenshot/video renders (`npm run promo*`), or any release/deploy commands (`npm run release`, `npm run release:tag`, `relay:deploy`, `deploy:itch`, `ios*`, `android*`). Smoke tests (`npm run test:browser`, `npm run test:build`, `npm run test:road-landings`) and single verification screenshots (`node scripts/shot.js`) work with SwiftShader and are encouraged.
- **Deterministic tests**: Tests must pass or fail the same way every run. The world seed defaults to today's date, so every test pins it (`ChillFlightLogic.WORLD_SEED` and `simplex.seed()` in Node scripts, `?seed=` in browser tests), and any randomness a test uses is seeded.
- **Empirical Visual Debugging**: When investigating visual, physics, or rendering bugs, do not rely purely on static code analysis. Proactively write temporary headless Chrome (`puppeteer-core`) scripts in your `scratch/` directory (using `launch` and `openGame` from `scripts/dev-browser.js`) to load the local dev server and capture screenshots or DOM state to verify issues empirically. Always append `&start=1&music=0` to your testing URLs to automatically bypass the splash screen and bypass audio autoplay policies.
  - **One headless Chrome at a time**: Never launch multiple Puppeteer scripts (`npm run test:browser`, `npm run test:build`, `scripts/shot.js`, or scratch scripts) in parallel across background tasks or subagents. Concurrent WebGL contexts and terrain worker pools exhaust RAM into swap and overheat local machines.
  - **Reuse one tab for parameter sweeps**: When comparing multiple parameter or uniform values in the same scene, load the page once and mutate uniforms or state via `window.gameModule(...)` between captures rather than reloading the full game URL for every shot.
  - **Lightweight comparison images**: Prefer `.jpg` (`1280x720`, `quality: 85`) over full-resolution `.png` files for multi-image carousels and sweep artifacts so the chat UI renderer stays cool.

## Module rules

- **ES modules only**: All game code is ES modules. `src/main.js` imports every game module in load order. Share code through `import`/`export`; never add `window` globals for other modules to read (`npm run test:globals` fails on `window` reads that nothing assigns). Intentional `window` use is limited to runtime/third-party globals (Capacitor, Tauri, analytics, the version info Vite injects), `openExternalLink` (called from `onclick` attributes in `index.html`), and debug pages' own `onclick` handlers.
- **Import order**: A module may only import modules listed before it in `src/main.js` (`npm run test:imports` enforces this). This keeps the module graph free of cycles, which would otherwise run a module before the modules it depends on. New modules go in `src/main.js` after everything they import.
- **Shared mutable state**: Values written by more than one module live on the `state` object in `state.js` (`state.isPaused = true`). Values reassigned only by their own module can be `export let` (importers see updates but can't assign).
- **Network calls**: Every network request needs a deadline. Use `fetchWithTimeout()` or `withTimeout()` from `network.js`, and fall back to bundled assets on timeout. Never rely on `navigator.onLine` alone, and never make game start wait on the network. That includes render-blocking `<link>`/`<script>` tags to third-party hosts: bundle fonts and other assets instead.
- **Calling later modules**: If a module needs to call a function from a module that loads after it, the later module registers it on `hooks` in `hooks.js` at load, and callers use `hooks.name?.()`. Prefer moving code to the right module first; use hooks only for genuine late-bound callbacks.

## UI & typography rules

- **Sentence case only**: Always use "Sentence case" instead of "Title Case" for UI text, labels, buttons, and titles, as well as titles and headers in all documentation (such as the README). Strings that are intended to be ALL CAPS should remain so.
- **Translate on-screen text**: Every string a player can see goes through `t()` from `i18n.js` (English is the key) and gets a line in each table in `locales/` (zh-CN, zh-TW, ja, ko, es, pt-BR, de, fr: a new string needs a line in every one). Static text in `index.html` is translated automatically, but it still needs a table entry. Put placeholders in the string (`t('{name} joined', {name})`) rather than gluing translated pieces together, and pass each piece of text to its own `t()` (`x ? t(x) : t('Empty')`, not `t(x || 'Empty')`). Wrap debug-only UI in `data-no-translate`. `npm run test:i18n` (part of `npm test`) fails on any missing translation, and `node scripts/check-i18n.js --missing` lists them. See the README's Language section.
- **No em dashes**: Never use em dashes (`—` or `&mdash;`) in any writing, including UI text, release notes, documentation, scripts, commit messages, or chat responses. Use hyphens (`-`), colons (`:`), commas, or parentheses instead.

## Geometry & model rules

- **Debug page update**: When adding a new geometry or model to the game, always add it to the model debug page (`debug/debug-models.html`) as well, so it can be previewed.

## Directory rules

- **Do not touch the docs directory**: The `docs/` directory is strictly for compiled production builds generated automatically by Vite. Never edit, search, or read files inside the `docs/` directory. All development, changes, and queries must be executed against the root source files (like `game.js`, `airplane.js`, `style.css`, root `index.html`, `debug/debug.html`, etc.).

## Location reporting rules

- **Always report locations in both units and lat/long**: Whenever identifying, referencing, or reporting a landmark, biome boundary, or coordinates in the game world, always specify the location in both in-game coordinate units (e.g., `X = -3000`, `Z = 5000`) and latitude/longitude format (e.g., `0.6 West`, `1.0 South`).

## Release workflow & release notes

- **macOS only (`process.platform === 'darwin'`)**: Never cut, prepare, or tag a release (`npm run release` or `npm run release:tag`) in a Linux cloud container (`process.platform !== 'darwin'`). Stop immediately before running any release commands and ask the user to run the release from a local macOS session.
- **Use the `release` skill**: Whenever asked to prepare, cut, or publish a release, or to generate/update `RELEASE_NOTES.md`, read and follow `.agents/skills/release/SKILL.md` (which defines the 7-step release bundle flow, explicit commit approval before `npm run release:tag`, preview-URL formatting, and the strict 500-character entry limit).

## Documentation rules

- **Keep README up to date**: Whenever modifying, adding, or adjusting game features, controls, graphics presets, mechanics, or URL parameters, always ensure the corresponding documentation and tables in `README.md` are updated to reflect the changes.

## Communication rules

- **No background task announcements**: To avoid sending separate, unprompted chat messages that bury important context, **never** run short commands like `npm run format` or `git add` asynchronously. Always set `WaitMsBeforeAsync` to a high value (e.g., `5000` or `10000`) for these tools so they complete synchronously within your turn. You can then provide a single, comprehensive response to the user.

## ESLint & refactoring rules

- **Zero lint warnings standard**: The codebase maintains a strict zero-warning policy enforced by `npm run lint` (`eslint . --max-warnings=0`). Never propose or stage commits that introduce ESLint warnings or errors. Always run `npm run lint` or `npm test` as part of your verification pass before asking for commit approval.
- **Strict refactoring verification**: `npm run lint` enforces `no-undef` as an error, including inside `typeof` checks. When refactoring code, extracting functions, or changing variable scope, also run ESLint with `no-use-before-define` elevated to an error (e.g., `npx eslint <file> --rule 'no-use-before-define: error' --quiet`) and check any new hits, since the default configuration doesn't enable that rule.
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
