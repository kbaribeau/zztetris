# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Static GitHub Pages app: no build step. Test setup, coverage and renderer/host limits live in [TESTING.md](./TESTING.md); run `npm test` using `.nvmrc`.
- Shared top navigation is defined in `navigation.js` and `styles/navigation.css`; actual-page coverage and the shipped-screen inventory guard live in `test/navigation.test.cjs`. Add new screens to the manifest in `test/support/pages.cjs`.
- ST-lab architecture, rules profile and acceptance limits are documented in [ST-LAB.md](./ST-LAB.md). The lab uses a pure once-per-lock rules kernel and worker-backed finite-information planner; ordinary engines remain separate. Read [docs/st-lab-vision.md](./docs/st-lab-vision.md) for product direction and the linked milestone plan before implementing coaching.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
