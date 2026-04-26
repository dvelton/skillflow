# Skillflow

A lot of useful AI work now lives in markdown files: review playbooks, drafting patterns, research checklists, coding conventions, support runbooks, compliance guides, customer-response templates. The files are simple, which is why they work. But once a team has more than a handful, things tend to get scattered. Which skills does this project actually use? Are they the same versions across machines? Do they work with whatever AI tool someone happens to prefer? And do they ever get better on their own, or does someone have to manually rewrite them every time the output falls short?

Skillflow is a tool-agnostic skillset manager that tries to address that layer. It gives a project a manifest, a lockfile, exports for different AI tools, and a local feedback loop that captures the last mile of human edits.

It is not tied to coding. A skill can be a legal review process, sales response guide, research method, product launch checklist, contract playbook, writing style guide, engineering convention, support workflow, or any other repeatable instruction package.

## What Skillflow adds

```
skillflow.yaml       what this project uses
skillflow.lock       exactly what got resolved
.agents/skills/      portable exported skills
.skillflow/feedback/ local last-mile learning
```

The goal is simple: make reusable AI skills feel less like loose files and more like dependable project infrastructure.

## Why this exists

In a lot of teams, AI instructions end up scattered. One person has skills in one tool. Another has rules in a different one. A repo has some custom instructions checked in. Someone else has a private prompt doc. The pieces may be useful individually, but there is no single place that says "this project uses these skills, at these versions, exported to these tools."

There is also a feedback problem. A skill says what the author thought would work. But often the most useful signal comes later, after the AI output is close and a human makes the final edits. Those edits can reveal what the skill was missing: a caveat people keep adding, a structure they keep changing, a phrase they keep removing, a level of detail they consider actually usable. That signal usually gets lost.

Skillflow tries to address both parts. The manifest makes skills repeatable. The last-mile loop captures repeated human edits and turns them into proposed improvements.

## How it works

```
Define skills        skillflow.yaml lists sources, requirements, and collections
        |
        v
Resolve and lock     skillflow.lock records paths, refs, and integrity hashes
        |
        v
Export               skills are copied into whichever AI tool folders the project uses
        |
        v
Capture edits        AI draft is compared with the human-edited final version
        |
        v
Improve              repeated edit patterns become reviewable overlays
```

Skillflow does not silently rewrite your canonical skills. It proposes improvements that a person can review, edit, apply locally, or turn into a pull request.

## Install from GitHub

Skillflow requires Node.js 20 or newer.

Skillflow is not published to the npm registry. Use npm only as a GitHub installer:

```bash
npm install -g github:dvelton/skillflow
```

To pin a release or tag:

```bash
npm install -g github:dvelton/skillflow#v0.1.0
```

You can also clone and link locally:

```bash
git clone https://github.com/dvelton/skillflow.git
cd skillflow
npm install
npm run build
npm link
```

Then verify:

```bash
skillflow --help
```

## Start a skillset

In any project:

```bash
skillflow init
```

This creates `skillflow.yaml`:

```yaml
schema_version: "1.0"
name: my-project
version: "0.1.0"
description: Reusable skills and last-mile learning for this project.
config:
  export_targets:
    - generic
  install_mode: copy
skills:
  - name: example-skill
    source: local:./skills/example-skill
    description: Replace this with what the skill does and when to use it.
collections:
  - name: default
    required:
      - example-skill
```

Create the skill:

```text
skills/example-skill/
  SKILL.md
```

`SKILL.md` can use the common Agent Skills format:

```markdown
---
name: example-skill
description: What this skill does and when to use it.
---

# Example Skill

Follow these instructions when this workflow is relevant.
```

Install and export:

```bash
skillflow install
```

By default, Skillflow resolves skills into `.skillflow/skills` and exports them to `.agents/skills`.

## Export to AI tools

The same skillset can be exported to different AI tools:

```bash
skillflow export --target <tool>,<tool>
```

Skillflow ships with adapters for common agent tool directories:

| Target | Folder |
| --- | --- |
| `generic` / `amp` | `.agents/skills` |
| `claude` | `.claude/skills` |
| `copilot` | `.github/skills` |
| `cursor` | `.cursor/skills` |
| `codex` | `.codex/skills` |
| `goose` | `.goose/skills` |
| `opencode` | `.opencode/skill` |

This keeps the skill format portable. Skillflow adapts to the tool; the skill does not have to be rewritten for each tool.

## Learn from the last mile

Capture the AI-generated draft before human editing:

```bash
skillflow last-mile capture draft.md --skill customer-faq
```

After a human edits the draft into the final version:

```bash
skillflow last-mile learn final.md --skill customer-faq
```

Generate improvement candidates:

```bash
skillflow last-mile suggest --skill customer-faq
```

Review `.skillflow/feedback/customer-faq/candidates.md`, then approve one or more patterns:

```bash
skillflow last-mile approve --skill customer-faq --id <pattern-id>
```

You can approve all patterns that meet the threshold:

```bash
skillflow last-mile approve --skill customer-faq --all
```

Promote approved patterns into a local overlay:

```bash
skillflow last-mile apply --skill customer-faq --scope personal
```

The overlay is written to:

```text
.skillflow/overlays/personal/customer-faq.md
```

That file is plain markdown. You can read it, edit it, use it as a personal preference layer, share it with a team, or fold parts of it back into the underlying skill.

## What last-mile learning catches

There is a useful distinction between stated preferences (what people say they want during a conversation with an AI tool) and revealed preferences (what they actually do when editing the final draft). The conversation captures the first kind. The last-mile edit captures the second: what the human chose when the output had to be good enough to send, ship, file, publish, or rely on.

Over time, Skillflow can surface patterns like:

- The human keeps converting prose into tables.
- The human keeps cutting long setup paragraphs.
- The human keeps adding a risk caveat before a recommendation.
- The human keeps replacing formal phrases with direct language.
- The human keeps adding a missing checklist step.
- The human keeps expanding short answers with implementation detail.

A single edit could mean anything. But when the same kind of edit keeps showing up across different drafts from the same skill, it probably points to something the skill should account for.

## Generic by design

Skillflow does not know whether your output is legal advice, code, policy, sales collateral, research notes, customer support, or internal process docs. It only knows:

1. Which skill produced the draft.
2. What the draft looked like.
3. What the human-edited final version looked like.
4. Which edit patterns keep recurring.

That makes it potentially useful across domains without requiring a separate memory system for each field.

## Privacy and safety

Skillflow is local-first.

Raw drafts and diff evidence stay under `.skillflow/feedback`. Canonical skills are not changed automatically. Learned patterns become summaries and overlays that a human reviews before use.

A typical setup:

| Commit | Keep local |
| --- | --- |
| `skillflow.yaml` | `.skillflow/feedback/` |
| `skillflow.lock` | raw draft snapshots |
| skill source files | personal overlays, unless intentionally shared |

If the feedback may contain confidential, privileged, customer, proprietary, or personal information, do not commit it.

## Commands

| Command | Purpose |
| --- | --- |
| `skillflow init` | Create a starter manifest |
| `skillflow install` | Resolve skills, write the lockfile, and export to configured targets |
| `skillflow export --target <tool>,<tool>` | Export locked skills to tool-specific folders |
| `skillflow validate` | Check manifest, lockfile, skills, and collection references |
| `skillflow graph` | Print skill dependencies and requirements |
| `skillflow list` | List declared and locked skills |
| `skillflow router` | Generate a compact router skill for the skillset |
| `skillflow scan` | Scan locked skills for possible secrets or risky instructions |
| `skillflow doctor` | Show setup status and likely next actions |
| `skillflow last-mile capture` | Save an AI draft before human editing |
| `skillflow last-mile learn` | Compare a draft with the final human-edited version |
| `skillflow last-mile suggest` | Generate reviewable improvement candidates |
| `skillflow last-mile approve` | Approve learned patterns before promotion |
| `skillflow last-mile apply` | Write a local overlay from approved patterns |

## Source formats

Local skills:

```yaml
skills:
  - name: privacy-review
    source: local:./skills/privacy-review
```

GitHub skills:

```yaml
skills:
  - name: pdf
    source: github:some-org/skills/skills/pdf
    ref: main
```

Use `version` for a tag and `ref` for a branch or commit SHA.

## What this is not

Skillflow is not a hosted registry, a model wrapper, or a replacement for the Agent Skills format. It is the project layer around skills: resolve them, lock them, export them, validate them, and learn how they should improve.

The markdown stays simple. The system around it tries to make that simplicity sustainable.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
