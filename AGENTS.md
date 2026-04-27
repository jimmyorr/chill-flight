## Git & Workflow Rules
- **Manual Commits Only**: Do not create git commits automatically. When a task or skill (including TDD or subagent workflows) reaches a commit point, you must stop, stage the changes, and ask for explicit permission before committing.
- **No Standing Permission**: A previous approval to commit does not grant permission for future commits. Each commit requires a fresh "go ahead."
- **Verification First**: Always run the relevant verification/test command before asking to commit, but do not proceed to the `git commit` command yourself.

## UI & Typography Rules
- **Sentence Case Only**: Always use "Sentence case" instead of "Title Case" for UI text, labels, buttons, and titles. Strings that are intended to be ALL CAPS should remain so.
