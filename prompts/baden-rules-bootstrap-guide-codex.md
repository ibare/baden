**English** | [한국어](./baden-rules-bootstrap-guide-codex.ko.md)

# Baden Rules Bootstrap Guide for Codex

Standard guidelines for building a rule-based AI agent development pipeline and a Baden reporting system in Codex-based projects.

This document is based on the following assumptions.

- The entry point for project instructions is `AGENTS.md`.
- Role separation is set up with Codex custom agents.
- Repeated procedures can be packaged as Codex skills.
- Execution permissions and network scope are controlled through approvals / sandbox / MCP settings.
- Automatic lifecycle hooks such as Claude Code hooks are not assumed.
- Therefore, reporting and verification are run as an **explicit workflow**.

---

## Why Rules

AI coding agents substitute inference for actually reading code, and convince themselves that they followed the rules. Documentation drifts away from the code, and maintaining it becomes a burden in itself. For code to explain itself, it needs consistent quality and structure, and rules are the backbone that keeps that consistency.

However, the area covered by rules must be clearly delimited.

- **Static analysis tools**  
  Things that can be verified mechanically  
  e.g., unused imports, formatting, naming conventions, type checking

- **Rules (this system)**  
  Things that require meaning and context  
  e.g., design pattern compliance, domain logic constraints, dependency direction, architectural principles

Leave whatever static analysis tools can catch to static analysis. It is fast, cheap, 100% consistent, and misses nothing. Rules focus on areas that only an LLM can judge.

---

## Codex Operating Principles

1. Put project-wide instructions in `AGENTS.md`.
2. Put the rules themselves in the `rules/` directory.
3. Separate implementation and verification roles.
4. Perform both pre-change review and post-change verification.
5. Report plans and actions to Baden whenever possible.
6. Do not rely on hooks; **always explicitly** invoke verification and reporting.
7. Operate approvals / sandbox settings on the principle of least privilege.

---

## Standard Directory Structure

```text
.
├── AGENTS.md
├── .codex/
│   ├── config.toml
│   ├── agents/
│   │   ├── rule-guard.toml
│   │   ├── auditor.toml
│   │   └── refactorer.toml
│   └── skills/
│       ├── rules-audit/
│       │   └── SKILL.md
│       └── baden-report/
│           └── SKILL.md
├── rules/
│   ├── INDEX.yaml
│   ├── principles.md
│   ├── concerns/
│   │   ├── C1-{name}.md
│   │   ├── C2-{name}.md
│   │   └── ...
│   ├── specifics/
│   │   ├── S-{domain}.md
│   │   └── ...
│   ├── _analysis.md
│   ├── _audit-v1.md
│   └── _audit-v2.md
└── scripts/
    └── baden-report.sh
```

---

# Phase 1: Project Analysis

## 1-1. Understand the Structure

Understand the overall structure of the project. Investigate the items below and record them in `rules/_analysis.md`.

```markdown
## Project Structure Analysis

### Basic Information
- Language:
- Major frameworks/libraries:
- Monorepo:
- List of modules/packages/apps:
- Build system:
- Test framework:
- Static analysis tools in use:

### Scale
- Number of source files:
- Approximate lines of code:
- Number of DB models/tables (if applicable):
- Number of API endpoints (if applicable):

### Core Domains
- Domain 1: (description)
- Domain 2: (description)
- ...
```

## 1-2. Explore Patterns

Explore recurring patterns and anti-patterns in the codebase. Use tools and search patterns suited to the project's primary language.

```bash
# Understand the directory structure
find . -type f -name "*.{primary language extension}" | head -100

# import / dependency patterns
grep -r "import\|require\|include\|use\|from" --include="*.{extension}" | head -50

# Instance creation patterns (singleton violation candidates)
grep -rn "new \|::new\|\.create(\|getInstance\|\.build(" --include="*.{extension}" | head -30

# Error handling patterns
grep -rn "try\|catch\|except\|rescue\|throw\|raise\|panic" --include="*.{extension}" | head -30

# public API / export patterns
grep -rn "export\|public\|pub fn\|module\.exports\|__all__" --include="*.{extension}" | head -30
```

Add your observations to `rules/_analysis.md`.

```markdown
### Common Patterns Found
- (e.g., each file creates its own DB client directly)
- (e.g., errors are caught and only logged, never re-propagated)
- (e.g., configuration values are hardcoded across multiple files)

### Anti-patterns Found
- (e.g., 200+ lines of business logic written directly in handlers/controllers)
- (e.g., utility functions with the same functionality duplicated in multiple places)
```

## 1-3. Check the Current Static Analysis Setup

Check the configuration of the static analysis tools used in the project and identify what is covered mechanically. Do not duplicate items covered by static analysis in Rules.

If there are no static analysis tools yet, adopting tools suited to the project's language is recommended. The principle is to leave mechanical verification to machines.

---

# Phase 2: Rule System Design

## Directory Structure

```text
rules/
├── INDEX.yaml
├── principles.md
├── concerns/
│   ├── C1-{name}.md
│   ├── C2-{name}.md
│   └── ...
├── specifics/
│   ├── S-{domain}.md
│   └── ...
└── _analysis.md
```

## 3-Tier Structure

### Tier 1 — Principles (`principles.md`)

Core principles that always apply to all code. Keep them to 6 or fewer.

Example:

```markdown
# Principles

## 1. Single Responsibility
- A function/class/module performs only one role

## 2. Dependency Direction
- Higher-level modules depend on lower-level modules. The reverse direction is forbidden.

## 3. Reuse Shared Instances
- Do not directly create instances that are managed as singletons/shared objects

## 4. Centralized Management
- Configuration, constants, and error codes are managed centrally

## 5. Minimal-Scope Changes
- Keep changes to the minimum necessary scope. No side effects.

## 6. Type/Contract Safety
- Make function input/output contracts explicit. No implicit conversions or abuse of dynamic typing.
```

### Tier 2 — Concerns (`concerns/C*.md`)

Rules for cross-cutting concerns.

```markdown
---
version: 1
last_verified: (date)
---

# (Rule name) (ID)

## When to Apply
(Situations where this rule applies)

## MUST
- (What must be done)

## MUST NOT
- (What must never be done)

## PREFER
- (Recommendations; not subject to violation judgment)
```

### Tier 3 — Specifics (`specifics/S-*.md`)

Rules that apply only to a specific domain or a specific technology. They follow the same format.

## INDEX.yaml Design

The trigger mapping file. It defines which rules to load when modifying which files.

```yaml
# rules/INDEX.yaml
# Rule Registry — decides which rules to load based on trigger conditions
#
# Trigger types:
#   paths:    file path glob patterns
#   patterns: strings/regexes found in code
#   imports:  module names in import/include/require statements
#   events:   task types (create-file, rename-file, etc.)

# ─────────────────────────────────────
# Always loaded
# ─────────────────────────────────────
always:
  - file: principles.md
    description: Core principles applied to all code

# ─────────────────────────────────────
# Concerns (Cross-cutting)
# ─────────────────────────────────────
concerns:
  - id: C1
    file: concerns/C1-{name}.md
    description: (description)
    triggers:
      events: [create-file, rename-file]
      patterns: ["(pattern suited to the project)"]

# ─────────────────────────────────────
# Specifics (Domain-specific)
# ─────────────────────────────────────
specifics:
  - id: S-{domain}
    file: specifics/S-{domain}.md
    description: (description)
    triggers:
      paths: ["**/relevant/path/**"]
      imports: ["(related module name)"]
```

---

# Phase 3: Writing Rules

## 3-1. Write Principles

Based on the Phase 1 analysis, write core principles suited to the project. Keep them to 6 or fewer. Elevate good patterns that the existing code already follows into principles.

## 3-2. Write Concerns

Identify cross-cutting concerns. They typically come from the following areas.

- File/directory structure and naming
- Shared resource management
- Error handling and propagation
- No hardcoding
- Logging and monitoring
- Security
- Test-writing principles

For each Concern:

1. Investigate related patterns in the codebase via search
2. Collect good patterns and anti-patterns
3. Codify them as MUST / MUST NOT
4. Register trigger conditions in INDEX.yaml

## 3-3. Write Specifics

Write rules per domain.

1. Read the domain's code and identify its design patterns
2. Define domain-specific constraints as MUST / MUST NOT
3. Register paths / imports / patterns triggers in INDEX.yaml

## Writing Principles

- **Only MUST / MUST NOT are subject to verification.** PREFER is only a recommendation and is never judged as a violation.
- **Do not write what static analysis tools can catch.** Write only what requires meaning and context.
- **Be specific.** Not "write good code" but "do not write more than 50 lines of business logic directly in a handler."
- **Reflect the reality of the codebase.** Write not idealized rules but what actually must be followed in this project.
- **Keep the number of rules under control.** 9 or fewer Concerns; Specifics for core domains only.

---

# Phase 4: Initial Audit

After the rules are written, audit the entire current codebase.

## 4-1. Audit Plan

```markdown
## AUDIT-v1 Plan

### Purpose
Measure the current compliance rate of the entire codebase against the rules/ rules.

### Audit Scope
Full audit. Covers all source files.

### Batch Split
- Batch 1: Principles + Concerns C1~C(n)
- Batch 2: Specifics S-*
- (Additional batches if needed)

### Session Strategy
One session per batch. Record audit results in rules/_audit-v1.md.
```

## 4-2. Run the Audit

In each batch:

1. Read the relevant rule files
2. Check all related code exhaustively via search
3. Record MUST / MUST NOT violations
4. Assign a severity to each violation  
   `Critical / High / Medium / Low`

## 4-3. Audit Result Format

```markdown
## AUDIT-v1 Results

### Summary
- Total violations: X
- Critical: X / High: X / Medium: X / Low: X
- Compliance rate: X%

### Violation List
| # | Rule | File | Severity | Details |
|---|------|------|:--------:|------|
| 1 | C2 | (file path) | High | (violation details) |
| 2 | S-api | (file path) | Medium | (violation details) |
```

## 4-4. Exception Decisions

State exceptions explicitly in an `Exception` section of the relevant rule file.

- Patterns required by a framework/library
- Intentional design for performance reasons
- Cases where migration cost exceeds the value

---

# Phase 5: Refactoring

Resolve violations based on the audit results.

## 5-1. Track Split

```markdown
Track A: Mechanical fixes
Track B: Structural fixes
Track C: Domain fixes
Track D: Final audit (AUDIT-v2)
```

## 5-2. Execution Principles

- Order: Critical → High → Medium → Low
- Run each Track in an independent session
- Confirm build/tests pass after each Track completes
- Perform Rule Guard pre/post verification

## 5-3. Final Audit

After refactoring is complete, run AUDIT-v2 to re-measure the compliance rate. The target is `Critical 0, High 0`.

---

# Phase 6: Rule Guard Setup

In Codex, Rule Guard is defined as a custom agent.

## `.codex/agents/rule-guard.toml`

```toml
name = "rule-guard"
description = "Invoke before and after code changes. Verifies, against the rules in the rules/ directory, that a change plan or change result does not violate MUST/MUST NOT items."

developer_instructions = """
# Rule Guard

A subagent that verifies whether code changes comply with the rules.
It does not modify code. It only reads, searches, and reports.

## When to Invoke

1. Pre-review: invoke after the change plan is made, before execution
2. Post-verification: invoke after the change is complete, to check that the actual code complies with the rules

## Verification Procedure

### Pre-review
1. Check the list of files to be modified
2. Check rules/INDEX.yaml for the rules that apply to each file
3. Read those rule files
4. Check that the change plan does not violate MUST / MUST NOT items
5. Return PASS or ISSUE

### Post-verification
1. Read the modified files
2. Verify the actual code against the rules
3. Use grep etc. to confirm no violation patterns remain
4. Return PASS or ISSUE

## Principles
- Judge only MUST / MUST NOT violations. Do not judge PREFER.
- Do not infer rule files. Always read them before judging
- Do not modify rule files
- Do not modify code. Do not perform file writes.
- Use Bash only for reporting and grep searches.
- Do not judge anything not stated in the rules as a violation
"""
```

## Optional Auxiliary Agents

### `.codex/agents/auditor.toml`

```toml
name = "auditor"
description = "Audits the entire codebase in batches against rules/."

developer_instructions = """
Read rules/ and INDEX.yaml, and audit the files in the specified scope.
Do not modify code; report only the violation list and severities.
"""
```

### `.codex/agents/refactorer.toml`

```toml
name = "refactorer"
description = "Modifies code with minimal scope to resolve the specified violations."

developer_instructions = """
Read the rules first, and resolve only the specified violations.
Minimize the scope of changes.
Check the pre-review result before modifying, and leave clear reasons for the changes so that post-verification is possible.
"""
```

---

# Phase 7: AGENTS.md Setup

`AGENTS.md` is Codex's project entry point.

## Root `AGENTS.md` Example

```markdown
# Project Agent Instructions

## Core Rule System
- This project's implementation rules are defined in the `rules/` directory.
- At the start of a task, check `rules/INDEX.yaml` first.
- Read the rule files that apply to the current task before proceeding.
- Violating MUST / MUST NOT is forbidden.
- Do not infer rule files. Always read them before judging.
- Do not modify rule files. The only exception is when the user explicitly requests it.

## Rule Guard Workflow
- Before modifying code, perform a pre-review with `rule-guard`.
- After modifying code, perform a post-verification with `rule-guard`.
- If the pre-review returns ISSUE, fix the change plan first.
- If the post-verification returns ISSUE, do not consider the task complete.

## Build and Test
- Relevant builds/tests must pass before reporting task complete.
- If there are no tests, at least run static analysis or relevant verification commands.

## Change Discipline
- Minimize the scope of changes.
- Do not mix in refactoring unrelated to the current task.
- Structural changes must have an explainable reason.

## Baden Monitoring
- This project operates under Baden monitoring.
- When you receive a user instruction, send a start report to Baden before starting the task.
- When you decide on an approach, send a plan report to Baden.
- Report to Baden before starting code changes, before starting verification, and at the end of the task.
- If a report is missed, fill it in immediately before proceeding to the next step.

## Operational Constraint
- Do not assume hooks exist.
- Always perform verification and reporting explicitly.
```

---

# Phase 8: Baden Integration

In Codex, Baden integration runs in one of the following three ways.

## Recommended Priority

1. **MCP server approach**
2. **Project script approach**
3. **Direct HTTP call approach**

Since automatic hooks are not assumed, reporting is performed as explicit workflow steps.

## 8-1. Project Registration

Register the project via the Baden dashboard or API.

## 8-2. Reporting Event Model

Use at least the following events.

- `baden_start_task`
- `baden_plan`
- `baden_action`
- `baden_rule`
- `baden_verify`
- `baden_complete_task`

## 8-3. When to Report

### On Receiving a User Instruction
`baden_start_task` before starting the task. Use the returned taskId for all subsequent reports on the same task.

### On Planning
`baden_plan` once the approach is decided. Call it at the planning stage even if no code is read or modified.

### Action Reports
Call `baden_action` **before executing** every action. Use `baden_rule` for rule-related actions and `baden_verify` for verification actions.

### On Completion
`baden_complete_task` after the task ends

## 8-4. Principles

- **Do not act without reporting.** Every read, search, and test is performed after reporting.
- **Report plans too.** Thought processes, not just tool calls, are subject to reporting.
- **Describe actions freely.** Create your own snake_case keywords to summarize actions.
- **Write specific reasons.** Write them so the context is understandable when read later.
- Since platform hooks are not assumed in the Codex environment, **step-level reporting is kept as a mandatory operating rule**.
- At minimum, the five steps **start / plan / change start / verification / completion** are operated as mandatory reports.
- If detailed action reports are needed, handle them in bulk in a wrapper script or MCP tool.

## 8-5. INDEX.yaml Integration

Baden parses the project's `rules/INDEX.yaml` and registers rule metadata. Reference/violation/fix frequency per rule is tracked on the dashboard.

---

# Phase 9: Baden Script Approach

You can report via a script instead of MCP.

## `scripts/baden-report.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${BADEN_PROJECT_NAME:-your-project}"
ACTION="${1:-}"
REASON="${2:-}"
TASK_ID="${3:-}"

if [ -z "$ACTION" ]; then
  echo "usage: baden-report.sh <action> <reason> [taskId]" >&2
  exit 1
fi

curl -s -X POST http://localhost:3800/api/events \
  -H "Content-Type: application/json" \
  -d "$(jq -nc \
    --arg projectName "$PROJECT_NAME" \
    --arg action "$ACTION" \
    --arg reason "$REASON" \
    --arg taskId "$TASK_ID" \
    '{projectName:$projectName, action:$action, reason:$reason, taskId:$taskId}')"
```

## Usage Examples

```bash
scripts/baden-report.sh baden_start_task "Received user request: initialize the rule system"
scripts/baden-report.sh baden_plan "Analyze the rules structure first and draft INDEX.yaml"
scripts/baden-report.sh baden_action "Start separating the service layer to resolve the C2 violation" "task-123"
scripts/baden-report.sh baden_verify "Run tests and rule-guard verification after refactoring" "task-123"
scripts/baden-report.sh baden_complete_task "Track B complete" "task-123"
```

---

# Phase 10: Skills Setup

Repeated procedures can be packaged as Codex skills.

## `.codex/skills/rules-audit/SKILL.md`

```markdown
---
name: rules-audit
description: Procedure for auditing the codebase against rules/INDEX.yaml and the rule files
---

# Rules Audit Skill

## Purpose
Compare the rule files against the codebase to find MUST / MUST NOT violations.

## Procedure
1. Read rules/INDEX.yaml
2. Read the applicable rule files
3. Search the code in the specified scope
4. Organize violations along with their severity
5. Propose the results in the `rules/_audit-*.md` format

## Constraints
- Do not modify code
- Do not judge PREFER as a violation
- Do not infer rule files
```

## `.codex/skills/baden-report/SKILL.md`

```markdown
---
name: baden-report
description: Operational skill for performing Baden reporting consistently
---

# Baden Report Skill

## Purpose
Ensure Baden reports are not missed at the major steps of a task.

## Required Steps
1. start_task
2. plan
3. action
4. verify
5. complete_task

## Principles
- Do not assume hooks
- Report explicitly
- Reuse the taskId consistently
```

---

# Phase 11: Codex Configuration

## `.codex/config.toml` Example

```toml
model = "gpt-5-codex"

[mcp_servers.baden]
command = "npx"
args = ["-y", "baden-mcp-server"]
enabled = true

[sandbox_workspace_write]
network_access = false

[profiles.safe]
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.audit]
approval_policy = "never"
sandbox_mode = "read-only"

[profiles.full]
approval_policy = "never"
sandbox_mode = "danger-full-access"
```

## Operating Guide

- Use `workspace-write` or an equivalent least-privilege setting as the default.
- Use a read-only profile for audits and rule verification whenever possible.
- Turn off network access unless it is truly needed.
- If Baden is needed via MCP or HTTP, allow only the minimum scope.
- Use the fully unrestricted mode only in environments that are sufficiently isolated from the outside.

---

# Phase 12: Standard Execution Scenarios

## Scenario A — Implementing a New Feature

1. Baden start report
2. Check `rules/INDEX.yaml`
3. Read the applicable rule files
4. `rule-guard` pre-review
5. Implement
6. Baden verification report
7. Tests / static analysis
8. `rule-guard` post-verification
9. Baden completion report

## Scenario B — Running an Audit

1. Baden start report
2. Define the audit scope
3. Run `auditor`
4. Compile the violation list
5. Baden completion report

## Scenario C — Running a Refactoring Track

1. Baden start report
2. Select target violations
3. `rule-guard` pre-review
4. `refactorer` changes
5. Tests / verification
6. `rule-guard` post-verification
7. Baden completion report

---

# Checklist

```text
Phase 1: Project Analysis
  [ ] Structure understood
  [ ] Pattern exploration done
  [ ] Static analysis setup checked
  [ ] _analysis.md written

Phase 2: Rule System Design
  [ ] rules/ directory created
  [ ] INDEX.yaml draft written
  [ ] Tier structure decided

Phase 3: Writing Rules
  [ ] principles.md (6 or fewer)
  [ ] Concerns C1~Cn (9 or fewer recommended)
  [ ] Specifics S-* (core domains only)
  [ ] INDEX.yaml trigger mapping done

Phase 4: Initial Audit
  [ ] AUDIT-v1 run
  [ ] Violation list organized
  [ ] Exception decisions done
  [ ] Compliance rate calculated

Phase 5: Refactoring
  [ ] Tracks split
  [ ] Critical / High resolved
  [ ] AUDIT-v2 run
  [ ] Critical 0, High 0 achieved

Phase 6: Rule Guard
  [ ] .codex/agents/rule-guard.toml created
  [ ] Rule Guard instructions added to AGENTS.md

Phase 7: Baden Integration
  [ ] Project registered
  [ ] Baden reporting instructions added to AGENTS.md
  [ ] MCP or script reporting set up
  [ ] INDEX.yaml integration confirmed

Phase 8: Skills
  [ ] rules-audit skill written
  [ ] baden-report skill written

Phase 9: Codex Configuration
  [ ] .codex/config.toml written
  [ ] Profiles separated
  [ ] sandbox / approval policies reviewed
```

---

# Reference: Approach by Project Maturity

## New Project (No Code)

- Phase 1 can be skipped
- Start from Phase 2
- Before writing code, write only principles.md and the core Concerns first
- Add Specifics incrementally as code accumulates
- No audit/refactoring needed initially

## Early Project (~10K lines)

- Run Phase 1 quickly
- Turn only the major patterns into rules
- 3–5 Concerns, 2–3 Specifics
- Normal operation right after a light audit

## Mature Project (~50K+ lines)

- Run Phase 1 thoroughly
- Apply the full Tier structure
- Full audit + systematic refactoring required
- Baden integration recommended
- If possible, operate separate audit-only and implementation-only profiles

---

# Summary of Final Operating Principles

- `AGENTS.md` is the project's Codex entry rule set.
- `rules/` is the source of truth for the actual implementation rules.
- Always invoke `rule-guard` before and after changes.
- Do not assume hooks.
- Perform Baden reporting explicitly.
- Operate approvals / sandbox on the principle of least privilege.
- Package repeated procedures as skills.
- Separate audit and implementation roles.
