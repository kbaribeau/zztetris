# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Static GitHub Pages app: no build step. Test setup, coverage and renderer/host limits live in [TESTING.md](./TESTING.md); run `npm test` using `.nvmrc`.
- Shared top navigation is defined in `navigation.js` and `styles/navigation.css`; actual-page coverage and the shipped-screen inventory guard live in `test/navigation.test.cjs`. Add new screens to the manifest in `test/support/pages.cjs`.
- ST-lab free-play scope, geometry/continuation contract and engine-replay evidence are documented in [ST-LAB.md](./ST-LAB.md); independent fixture boards are test-only, not authored gameplay starts.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
