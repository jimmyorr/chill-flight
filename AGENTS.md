## Git & Workflow Rules

- **Manual Commits Only**: Do not create git commits automatically. When a task or skill (including TDD or subagent workflows) reaches a commit point, you must stop, stage the changes, and ask for explicit permission before committing.
- **No Standing Permission**: A previous approval to commit does not grant permission for future commits. Each commit requires a fresh "go ahead."
- **Verification First**: Always run the relevant verification/test command before asking to commit, but do not proceed to the `git commit` command yourself.
- **Isolated Production Commits**: Keep updates to the production build (files under the `docs/` directory) completely isolated in their own commits, separate from dev source code changes.
  - Making regular source changes (e.g., editing `game.js` or `index.html`) should be committed in small, clean, source-only commits first.
  - Generating a production build (`npm run build` updating the `docs/` folder) should be treated as an intentional, independent step.
  - **Exception**: You should bundle the version bump (updating `package.json` and `package-lock.json`) in the same commit as the production build, as generating a new build often corresponds with a version release.

## Server & Verification Rules

- **Use Existing Server**: Do not start a local development server (e.g., `npx serve`, `npm run dev`). A Live Server is already running on port 5173. Use `http://localhost:5173` for all browser-based verification. Avoid browser-based verification unless it is absolutely necessary.

## UI & Typography Rules

- **Sentence Case Only**: Always use "Sentence case" instead of "Title Case" for UI text, labels, buttons, and titles. Strings that are intended to be ALL CAPS should remain so.

## Geometry & Model Rules

- **Debug Page Update**: When adding a new geometry or model to the game, always add it to the model debug page (`debug.html`) as well, so it can be previewed.

## Directory Rules

- **Do Not Touch the docs Directory**: The `docs/` directory is strictly for compiled production builds generated automatically by Vite. Never edit, search, or read files inside the `docs/` directory. All development, changes, and queries must be executed against the root source files (like `game.js`, `airplane.js`, `style.css`, root `index.html`, root `debug.html`, etc.).
