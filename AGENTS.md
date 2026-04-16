# Repository Guidelines

## Project Structure & Module Organization
This repository is a small TypeScript web app bundled with webpack. The main entry points live at the repo root: `index.ts` contains most UI and wallet logic, `state.ts` holds shared state, and `bootstrap.ts` initializes the app. Static assets such as `index.html`, `favicon.webp`, and `pico.min.css` also live at the top level. Utility scripts are in `scripts/`. End-to-end tests are split by environment under `tests/regtest`, `tests/testnet`, and `tests/boltz-regtest`.

## Build, Test, and Development Commands
Use `npm run start` to launch the webpack dev server on `http://localhost:8383`. Run `npm run build` to produce a production bundle in `dist/`. Lint with `npm run lint`; apply safe fixes with `npm run lint:fix`. Test commands switch the wallet network before running Playwright:

- `npm test` or `npm run test`: regtest suite
- `npm run test-testnet`: testnet suite
- `npm run test-boltz`: Boltz regtest suite

For local setup, install dependencies with `npm install`. On NixOS, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` so Playwright can launch Chromium.

## Coding Style & Naming Conventions
Follow the existing style in the repository: TypeScript with 4-space indentation, double quotes in most root TS files, and semicolons. Prefer vanilla web standards over frameworks. Keep logic inside web components where possible, use events for cross-component updates, and avoid global DOM ids when a scoped `querySelector` on the component is enough. File names use lowercase with dashes only when needed; test files follow `*.spec.ts`.

## Testing Guidelines
Playwright is the test framework. Keep tests environment-specific and place them in the matching `tests/<env>/` directory. Regtest and Boltz suites require external environments described in the local test READMEs before running the npm commands above. Use focused `--grep` runs only while developing; do not leave `.only` in committed tests.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects such as `add boltz-test` or `links to btcpos.cash`. Keep commits small and descriptive; avoid `wip` for reviewable work. Pull requests should state the target network or environment, summarize behavior changes, link related issues, and include screenshots or Playwright output when the UI or flow changes.
