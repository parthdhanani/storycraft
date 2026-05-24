# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅        |
| < 0.2   | ❌        |

## Reporting a vulnerability

Email: **parth1707ster@gmail.com**

Include:

- Storycraft version
- A minimal Markdown input that reproduces the issue
- Your assessment of impact

I aim to acknowledge within 72 hours and to ship a fix within 14 days for
confirmed issues.

## Threat model

Storycraft reads user-supplied Markdown and writes zip files. The relevant
threats:

- **Path traversal in output filenames** — `--out` must not be coerced
  outside the requested directory.
- **HTML/JS injection via Markdown** — the compiler emits Markdown into the
  SCORM HTML. Untrusted Markdown should not be able to execute scripts inside
  the SCORM player beyond the intended sandbox.
- **DoS via pathological Markdown** — parser passes should bound work.

The compiled SCORM package itself runs inside an LMS-controlled iframe; the
threat model for the runtime is that of an LMS-hosted course, not a
general-purpose web app.
