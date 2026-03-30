---
name: incident
description: Create an incident report for a bug or issue that affected users
argument-hint: "<short description of what happened>"
---

Create an incident report in `docs/incidents/` following the project's incident template.

## File naming

Use the format: `YYYY-MM-DD-<short-slug>.md` (e.g. `2026-03-30-melting-funds-stuck.md`). Use today's date unless the user specifies otherwise.

## Template

```markdown
# Incident: <Title>

| Field | Value |
|---|---|
| Date discovered | YYYY-MM-DD |
| Severity | Low / Medium / High / Critical |
| Loss of funds | No / Yes — <details> |
| Affected versions | <version range> |
| Fixed in | <version or "pending"> |
| Component | `<file or module>` |

## What happened

<2-3 sentences describing the user-facing impact. What did users see? What couldn't they do?>

## Mitigations

<Bulleted list of mitigations applied — tooling, workarounds, monitoring, etc.>

## Root cause & fixes

<For each bug/issue found:>

### Bug N: <short name>

**Location:** `<file>` (<function or line>)

**Problem:** <What the code does wrong>

**Symptom:** <Observable effect>

**Fix:** <What was changed, with code snippet if helpful>
```

## Instructions

1. Read the relevant code and git history to understand the issue
2. Ask the user for any details you can't determine from the code (severity, user impact, etc.)
3. Fill in all fields — don't leave placeholders
4. For "Fixed in", check the current version in `package.json` if already fixed, or write "pending"
5. Keep "What happened" non-technical enough for stakeholders, but make "Root cause & fixes" detailed enough for engineers
6. Write the file and report the path back to the user

The user's description: $ARGUMENTS
