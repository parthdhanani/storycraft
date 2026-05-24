# Storycraft

> Markdown storyboard → SCORM 1.2 package. CLI plus an in-browser playground.

```bash
storycraft my-course.md
# → my-course.zip  (uploadable to Moodle, TalentLMS, Cornerstone, LearnUpon, …)
```

Built for instructional designers who want to skip the storyboard → Storyline → publish cycle for rapid prototypes, simple compliance modules, and localised variants.

## Why this exists

Most teams treat the storyboard and the published course as two artifacts. Reviewers comment on a doc, the developer rebuilds it in Storyline, and any subsequent edit becomes a two-place update. Storycraft makes the storyboard the **source of truth** and the SCORM package a deterministic build artifact.

| | Before | With Storycraft |
|---|---|---|
| Storyboard → first reviewable build | a half-day in Storyline | seconds |
| Edit a typo found in QA | re-open Storyline, re-publish, re-zip | edit Markdown, rerun |
| Build 6 localised variants | 6 Storyline files, manual sync | 6 Markdown files, one build script |
| Output runs in any SCORM 1.2 LMS | ✔ via Storyline | ✔ — same |

It does **not** replace Storyline for visual-heavy or interaction-rich courses. It replaces it for the chunk of corporate modules that are essentially "slides + narration + a knowledge check + maybe a scenario."

## Quick start

```bash
git clone <repo>
cd storycraft
node src/storycraft.js examples/posh-awareness.md
# → dist/posh-awareness.zip
```

Upload the zip to Moodle as a SCORM activity. It tracks completion, score, and per-question results via the SCORM 1.2 API.

Or open `playground/index.html` in any browser — paste Markdown, download a SCORM zip in the browser. Pure client-side, no install.

## Storyboard syntax

```markdown
---
title: Workplace Respect — POSH Awareness
duration: 15min
passing_score: 70
language: en
---

## Slide: Welcome
[Narration] Welcome to this 15-minute course on workplace respect.
Click Next to begin.

## Check: Recognising harassment
[Q] Is repeated unwelcome banter over Slack covered under POSH?
[A*] Yes — verbal/written conduct of a sexual nature qualifies regardless of medium.
[A] No — Slack isn't covered.
[Feedback correct] Right — POSH applies wherever work happens.

## Branch: The hallway moment
[Prompt] You overhear a senior colleague making a suggestive comment...
[Option: Speak up → moment-speak]
[Option: Check in privately → moment-check]
[Option: Walk away → moment-walk]

## Slide: You speak up
[Id] moment-speak
Direct intervention can be powerful — when safe.
```

Full grammar in [`src/parser.js`](src/parser.js).

## What ships in the SCORM package

```
posh-awareness.zip
├── imsmanifest.xml      SCORM 1.2 manifest (ADL CAM)
├── player.html          SCO entry point
├── player.js            runtime: navigation, scoring, SCORM/xAPI calls
├── player.css           WCAG 2.2 AA styling; dark mode; prefers-reduced-motion
├── scorm12-api.js       LMS API wrapper; no-op fallback if launched standalone
└── assets/              any images you reference in the storyboard
```

The runtime:

- **Speaks SCORM 1.2:** `cmi.core.score.raw`, `cmi.core.lesson_status`, `cmi.core.session_time`, `cmi.interactions.*` (0-indexed)
- **Speaks xAPI** (optional): set `xapi.endpoint` and `xapi.auth` in frontmatter — emits `experienced`, `answered`, `passed`/`failed` statements
- **Runs standalone:** open `player.html` directly, SCORM calls degrade to no-ops, course still completes
- **WCAG 2.2 AA:** keyboard nav, focus management on slide change, `prefers-color-scheme`, `prefers-reduced-motion`, ARIA roles on radiogroups + progress bar

## Architecture

```
storyboard.md
   │
   ▼
parser.js (AST) ──► storycraft.js ──┬──► imsmanifest.xml
                                    ├──► player.html  (course JSON injected)
                                    ├──► runtime files
                                    └──► zip
```

Runtime is **pure JS, no dependencies, no build step**. CLI is **pure Node, no `npm install`**. The whole thing is ~700 lines of code. Runs offline on any machine with Node and `zip`.

## What it doesn't do (yet)

- Drag-and-drop, hotspot, dial interactions — Storyline territory
- Custom triggers/variables beyond branching and scoring
- AICC, SCORM 2004, cmi5 — only SCORM 1.2 today (cmi5 is on the roadmap)
- Multi-SCO packages — single-SCO only

## Roadmap

- `--locale <lang>` for per-language builds from one source + override files
- `storycraft watch` for live-rebuild during authoring
- `storycraft lint` to validate a storyboard without building
- cmi5 target alongside SCORM 1.2

## Author

Built by [Parth Dhanani](https://psidex.com) — Senior Instructional Designer & SCORM Team Lead at Kidvento.

Designed for the workflow that handled 100+ K-12 SCORM packages at Kidvento and 6-language localisations at Learning Owl.
