# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## Project status: early / scaffolding stage

`AI-System-Hub` is at the very beginning of its life. As of this writing the
repository contains only:

- `README.md` — a title placeholder.
- `.gitignore` — the standard template for **AL projects targeting Microsoft
  Dynamics 365 Business Central**.
- `CLAUDE.md` — this file.

There is **no application source code, build configuration, dependency manifest,
or test suite yet.** Do not assume a structure that is not present on disk.
Before acting on any instruction in this document, verify it still matches the
working tree — this file describes intent and conventions as much as current
reality, and the codebase will outgrow it quickly.

## What the tooling tells us

The `.gitignore` is the canonical AL / Business Central template. It ignores
artifacts produced by the AL Language extension and the BC toolchain:

- `.vscode/`, `.alcache/`, `.alpackages/`, `.snapshots/`, `.output/`
- Compiled extensions: `*.app`
- RAD and translation artifacts: `rad.json`, `*.g.xlf`
- License files: `*.bclicense`, `*.flf`
- Test output: `TestResults.xml`

This strongly implies the project is intended to be a **Business Central
extension written in AL** (Application Language), developed in VS Code with the
AL Language extension. Treat that as the working assumption until code lands
that contradicts it.

> If the project pivots to a different stack, update this file in the same
> change that introduces the new tooling.

## Expected layout (AL / Business Central convention)

When AL code is added, follow the standard Business Central project layout so
the AL compiler and `app.json` resolve sources correctly:

- `app.json` — extension manifest (id, publisher, version, id ranges,
  dependencies, platform/application versions). Required at the repo root for an
  AL app.
- `*.al` source files — typically grouped by object type or feature, e.g.
  `src/`, with subfolders such as `Tables/`, `Pages/`, `Codeunits/`,
  `Reports/`, `Enums/`, `PermissionSets/`.
- `Translations/` — `*.xlf` translation files (`*.g.xlf` is generated and
  git-ignored).
- `.vscode/launch.json` — sandbox/server launch config (git-ignored; do not
  commit environment-specific endpoints or credentials).

Object names and IDs must fall within the `idRanges` declared in `app.json`.
Confirm the assigned ranges before creating new objects.

## Development workflow

The toolchain is not yet committed, so there is no project-defined build or test
command to run. Once the AL project exists, the normal flow is:

1. Open the folder in VS Code with the **AL Language** extension installed.
2. Maintain `app.json` (and `.vscode/launch.json`) for the target BC
   environment (sandbox / on-prem / cloud).
3. Build with **AL: Package** (`Ctrl+Shift+B`) to produce the `*.app`.
4. Deploy/run with **AL: Publish** (`F5`) against the configured environment.
5. Run AL test codeunits via the test runner / `AL: Run Tests`.

If and when CI, scripts, or a different stack are introduced, document the exact
commands here and prefer them over the manual steps above.

## Conventions for AI assistants

- **Do not fabricate structure.** This is a near-empty repo. Inspect the actual
  files before claiming anything exists. Keep generated/ignored artifacts
  (`.app`, `.alcache/`, `.alpackages/`, `*.g.xlf`, license files) out of commits.
- **Respect `.gitignore`.** Never force-add ignored build output, snapshots, or
  license files (`*.bclicense`, `*.flf`).
- **Never commit secrets or credentials** — including BC environment endpoints,
  service-to-service auth, or license files.
- **Keep this file current.** When you add the first real code, build config, or
  tests, expand the relevant sections above with concrete paths and commands in
  the same change.
- **Match surrounding style.** Once AL (or other) code exists, mirror its naming,
  object-ID ranges, and formatting rather than importing outside conventions.

## Git workflow

- `master` is the default branch.
- Active development for this task is on `claude/claude-md-docs-q0vpih`.
- Make focused commits with clear, descriptive messages. Open pull requests as
  drafts against `master`.
