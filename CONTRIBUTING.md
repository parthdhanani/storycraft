# Contributing to Storycraft

Storycraft compiles a Markdown storyboard into a SCORM 1.2 package. The bar
for new code is that it makes that specific transformation cleaner, more
deterministic, or more useful — not that it broadens the scope.

## What's in scope

- New Markdown features that map cleanly to SCORM 1.2 RTE primitives.
- Locale workflow improvements (`--locale`, `--locales`).
- Deterministic-build fixes (same input → byte-identical zip).
- Runtime fixes to `runtime/scorm12-api.js` for real LMS quirks.
- Additional examples under `examples/`.

## What's out of scope

- A second authoring grammar. Markdown is the input format; new input formats
  belong in a fork or a sibling project.
- SCORM 2004 output. The deliberate scope is SCORM 1.2 (and cmi5 via
  [scorm-kit](https://github.com/parthdhanani/scorm-kit)).
- General-purpose templating engines.

## How to propose a change

1. Open an issue describing the change and a small reproducing input.
2. Fork, branch, submit a PR against `main`.
3. Every behaviour change needs a test in `test/run.js`.
4. The CI matrix (Node 18 / 20 / 22) must stay green.

## Running tests

```bash
npm test
```

## Code style

- Plain CommonJS, two-space indent, semicolons.
- Keep the runtime (`runtime/scorm12-api.js`) standalone and dependency-free —
  it gets shipped inside every package.

## Reporting security issues

See [SECURITY.md](SECURITY.md).

## License

MIT. By contributing you agree your changes are released under the same license.
