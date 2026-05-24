# Changelog

All notable changes to Storycraft are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-20

Initial public release.

### Added
- Markdown storyboard → SCORM 1.2 package compiler (`storycraft <file.md>`).
- Three slide types: `Slide:`, `Check:`, `Branch:`.
- SCORM 1.2 RTE: `cmi.core.score.raw`, `cmi.core.lesson_status`, `cmi.core.session_time`, `cmi.interactions.*` (0-indexed).
- Optional xAPI emit when `xapi.endpoint` is set in frontmatter (statements: `experienced`, `answered`, `passed`/`failed`).
- WCAG 2.2 AA runtime: keyboard nav, focus management on slide change, `prefers-color-scheme`, `prefers-reduced-motion`, ARIA roles.
- Multi-locale builds (`--locale hi`, `--locales en,hi,ta`) — single source, N packages.
- Standalone mode: opening `player.html` directly degrades SCORM calls to no-ops; course still completes.
- In-browser playground (`playground/index.html`) — paste Markdown, download SCORM zip; pure client-side.
- Five example storyboards (4 English, 1 Hindi) covering content, check, branch, and assessment patterns.
- Deterministic output: two consecutive builds of the same source produce a byte-identical zip (asserted in `test/determinism.test.js`).

### Notes
- Pure Node CLI, no `npm install` required to run.
- Runtime: pure JS, zero runtime dependencies.
- Total source: ~750 lines across `parser.js`, `manifest.js`, `storycraft.js`.
