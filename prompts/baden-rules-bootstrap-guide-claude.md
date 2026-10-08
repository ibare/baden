**English** | [한국어](./baden-rules-bootstrap-guide-claude.ko.md)

# Baden Rules Bootstrap Guide

Standard instructions for building a rule-based AI agent development pipeline in a new or ongoing project.

## Why Rules

AI coding agents substitute inference for actually reading the code, and convince themselves that they followed the rules. Documentation drifts away from the code, and maintaining it becomes a burden in itself. For code to explain itself, it needs consistent quality and structure, and rules are the backbone that keeps that consistency.

However, the areas that rules cover must be clearly separated:

- **Static analysis tools** (ESLint, Pylint, RuboCop, Checkstyle, clippy, golangci-lint, etc.): things that can be verified mechanically (unused imports, formatting, naming conventions, type checking, etc.)
- **Rules (this system)**: things that require meaning and context (adherence to design patterns, domain logic constraints, dependency direction, architectural principles)

Leave to static analysis whatever static analysis can catch. It is fast, cheap, 100% consistent, and misses nothing. Rules focus on the areas that only an LLM can judge.

---

## Phase 1: Project Analysis

### 1-1. Understand the Structure

Understand the overall structure of the project. Investigate the items below and record them in `rules/_analysis.md`:

```
## Project Structure Analysis

### Basic Information
- Language:
- Main frameworks/libraries:
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

### 1-2. Explore Patterns

Explore recurring patterns and anti-patterns in the codebase. Use tools and search patterns suited to the project's primary language:

```bash
# Understand the directory structure
find . -type f -name "*.{primary language extension}" | head -100

# Dependency/import patterns
grep -r "import\|require\|include\|use\|from" --include="*.{ext}" | head -50

# Instance creation patterns (singleton violation candidates)
grep -rn "new \|::new\|\.create(\|getInstance\|\.build(" --include="*.{ext}" | head -30

# Error handling patterns
grep -rn "try\|catch\|except\|rescue\|throw\|raise\|panic" --include="*.{ext}" | head -30

# Public API / export patterns
grep -rn "export\|public\|pub fn\|module\.exports\|__all__" --include="*.{ext}" | head -30
```

Add your observations to `rules/_analysis.md`:

```
### Common Patterns Found
- (e.g., DB clients are created directly in each file)
- (e.g., errors are caught and only logged, never re-propagated)
- (e.g., configuration values are hardcoded across multiple files)

### Anti-patterns Found
- (e.g., 200+ lines of business logic written directly in handlers/controllers)
- (e.g., utility functions with the same functionality are duplicated in multiple places)
```

### 1-3. Check Static Analysis Coverage

Check the configuration of the static analysis tools used in the project and identify the areas covered mechanically. Do not duplicate in Rules anything already covered by static analysis.

If there are no static analysis tools yet, adopting tools suited to the project's language is recommended. The principle is to leave mechanical verification to machines.

---

## Phase 2: Rule System Design

### Directory Structure

```
rules/
├── INDEX.yaml              # Trigger mapping (which rules apply to which files)
├── principles.md           # Tier 1: core principles applied to all code
├── concerns/               # Tier 2: cross-cutting concerns (C1, C2, ...)
│   ├── C1-{name}.md
│   ├── C2-{name}.md
│   └── ...
├── specifics/              # Tier 3: domain-specific rules (S-*)
│   ├── S-{domain}.md
│   └── ...
└── _analysis.md            # Analysis record (not a rule; can be deleted after the work)
```

### 3-Tier Structure

**Tier 1 — Principles (principles.md)**

Core principles that always apply to all code. Keep them to 6 or fewer. Define them to fit the project's language and architecture. Example:

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
- Keep modifications to the minimum necessary scope. No side effects.

## 6. Type/Contract Safety
- Make the input/output contract of functions explicit. No implicit conversions or abuse of dynamic typing.
```

**Tier 2 — Concerns (concerns/C*.md)**

Cross-cutting concerns that apply across multiple domains. Each file follows the format below:

```markdown
---
version: 1
last_verified: (date)
---

# (Rule name) (ID)

## When to Apply
(Situations in which this rule applies)

## MUST
- (What must be done)

## MUST NOT
- (What must never be done)

## PREFER
- (Recommendations; not subject to violation judgment)
```

**Tier 3 — Specifics (specifics/S-*.md)**

Rules that apply only to a specific domain/technology. They follow the same format.

### INDEX.yaml Design

The trigger mapping file. It defines which rules to load when modifying which files:

```yaml
# rules/INDEX.yaml
# Rule Registry — determines which rules to load based on trigger conditions
#
# Trigger types:
#   paths:    file path glob patterns
#   patterns: strings/regexes found in code
#   imports:  module names in import/include/require statements
#   events:   task type (create-file, rename-file, etc.)

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

## Phase 3: Writing Rules

### 3-1. Write Principles

Based on the analysis results from Phase 1, write core principles that fit the project. Keep them to 6 or fewer. Elevate good patterns that the project's existing code already follows into principles.

### 3-2. Write Concerns

Identify cross-cutting concerns. They vary by language and framework, but generally come from the areas below:

- File/directory structure and naming
- Shared resource management (DB connections, HTTP clients, caches, etc.)
- Error handling and propagation
- No hardcoding (centralized management of configuration/constants)
- Logging and monitoring
- Security (authentication, authorization, input validation)
- Test-writing principles

For each Concern:
1. Investigate related patterns in the codebase by searching
2. Collect good patterns and anti-patterns
3. Codify them as MUST / MUST NOT
4. Register trigger conditions in INDEX.yaml

### 3-3. Write Specifics

Write domain-specific rules. For each core domain of the project:
1. Read the domain's code and identify its design patterns
2. Define the domain's own constraints as MUST / MUST NOT
3. Register paths/imports/patterns triggers in INDEX.yaml

### Writing Principles

- **Only MUST/MUST NOT are subject to verification.** PREFER is only a recommendation and is not judged as a violation.
- **Do not write what static analysis tools can catch.** Write only what requires meaning and context.
- **Be specific.** Not "write good code," but "do not write more than 50 lines of business logic directly in a handler."
- **Reflect the reality of the codebase.** Write not idealized rules, but what actually must be followed in this project.
- **Control the number of rules.** 9 or fewer Concerns; Specifics for core domains only.

---

## Phase 4: Initial Audit

Once the rules are written, perform a full audit of the current codebase.

### 4-1. Audit Plan

```markdown
## AUDIT-v1 Plan

### Purpose
Measure the current compliance rate of the entire codebase against the rules in rules/.

### Audit Scope
Full audit. Covers all source files.

### Batch Split (for context management)
- Batch 1: Principles + Concerns C1~C(n)
- Batch 2: Specifics S-*
- (Additional batches as needed)

### Session Strategy
One session per batch. Record audit results in rules/_audit-v1.md.
```

### 4-2. Run the Audit

In each batch:
1. Read the relevant rule files
2. Check all related code exhaustively by searching
3. Record MUST/MUST NOT violations
4. Assign a severity to each violation: Critical / High / Medium / Low

### 4-3. Audit Result Format

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

### 4-4. Exception Judgment

During the audit, classify "violations that cannot be fixed":
- Patterns required by a framework/library
- Intentional designs for performance reasons
- Cases where the migration cost exceeds the value

Mark exceptions as `**Exception**` in the relevant rule file.

---

## Phase 5: Refactoring

Resolve violations based on the audit results.

### 5-1. Track Split

Classify violations into Tracks by type:

```markdown
Track A: Mechanical fixes (rename, import cleanup, format unification, etc.)
Track B: Structural fixes (separation of responsibilities, service extraction, module splitting, etc.)
Track C: Domain fixes (resolving violations of domain-specific rules)
Track D: Final audit (AUDIT-v2)
```

### 5-2. Execution Principles

- Resolve in order: Critical → High → Medium → Low
- Work on each Track in an independent session
- Confirm build/tests pass after each Track is completed
- If Rule Guard is set up, perform pre/post verification

### 5-3. Final Audit

After refactoring is complete, run AUDIT-v2 to re-measure the compliance rate. The goal is Critical 0, High 0.

---

## Phase 6: Rule Guard Setup

### Agent Definition

`.claude/agents/rule-guard.md`:

```markdown
---
name: rule-guard
description: Call before and after code modifications. Verifies, against the rules in the rules/ directory, that a modification plan or modification result does not violate MUST/MUST NOT items.
tools: Read, Glob, Grep, Bash
---

# Rule Guard

A subagent that verifies whether code modifications comply with the rules.
It does not modify code. It only reads, searches, and reports.

## When to Call

1. **Pre-review**: Once a modification plan is made, call it before executing the modification
2. **Post-verification**: Once the modification is complete, call it to check that the actual code complies with the rules

## Verification Procedure

### Pre-review
1. Check the list of files to be modified
2. Check in rules/INDEX.yaml which rules apply to each file
3. Read the relevant rule files
4. Check that the modification plan does not violate MUST / MUST NOT items
5. Return the verdict → on PASS, proceed with the modification / on ISSUE, revise the plan

### Post-verification
1. Read the modified files
2. Verify the actual code against the rules
3. Exhaustively check with grep that no violation patterns remain
4. Return the verdict → on PASS, move to the next task / on ISSUE, fix again

## Principles

- Judge only MUST / MUST NOT violations. Do not judge PREFER.
- Do not infer rule files. Always read them before judging.
- Do not modify rule files.
- Do not modify code. Do not perform file writes.
- Use Bash only for reporting and grep searches.
- Do not judge anything not stated in the rules as a violation.
```

### Add to CLAUDE.md

```markdown
## Rule Guard
- When modifying code, call the rule-guard subagent twice:
  1. After making the modification plan, before execution → pre-review
  2. After the modification is complete → post-verification
- Builds/tests must pass before reporting task_complete
- Do not delegate compound tasks to a subagent. Split them into work units and call each separately

## Implementation Principles
- Implementation rules are defined in the rules/ directory
- Check rules/INDEX.yaml for the rules that apply to the current task
- Violating MUST/MUST NOT is forbidden
- Read the rule files first. Do not infer.
- Do not modify rule files
```

### Handling Context Compaction

`.claude/settings.local.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo '⚠️ Context compaction occurred. Re-read and follow the instructions below.' && echo '\\n=== CLAUDE.md ===' && cat CLAUDE.md && echo '\\n=== rule-guard ===' && cat .claude/agents/rule-guard.md"
          }
        ]
      }
    ]
  }
}
```

---

## Phase 7: Baden Integration (Optional)

With Baden, rule compliance becomes observable in real time.
The Baden README is the canonical source for the setup steps
([Setting Up Your Project](../README.md#setting-up-your-project)). This phase applies them to the project you just set up.

### 7-1. Prerequisites (the user does these)

Ask the user to confirm the following before continuing, and to tell you the registered project name:

- Baden is installed and running (`baden status`)
- The project is registered in the Baden dashboard with **Rules Path** set to the absolute path of this project's `rules/` directory
- The Baden MCP server is registered with Claude Code ([README — A-2](../README.md#a-2-register-the-mcp-server))

### 7-2. Add the Baden Monitoring instructions to CLAUDE.md

Copy the `## Baden Monitoring` block from [README — A-3](../README.md#a-3-add-the-monitoring-instructions) into CLAUDE.md as-is,
and set `Project Name` to the registered name. Do not rewrite it.

Then add this line to the `## Rule Guard` section from Phase 6:

```markdown
- When calling rule-guard, always include the current taskId in the prompt (this links the subagent's Baden reports to the task)
```

### 7-3. Let Rule Guard report to Baden

A subagent whose tools are restricted may not be able to call the `baden_*` MCP tools.
Rule Guard therefore reports over HTTP through a wrapper script that a SessionStart hook creates
([README — Reporting from Subagents](../README.md#reporting-from-subagents)).
In the examples below, replace `my-project` with the registered project name.

**1. `.claude/hooks/setup-baden.sh`** — make it executable (`chmod +x`)

```bash
#!/bin/bash
# Creates the wrapper subagents use to report to Baden over HTTP.
# /tmp is cleared on reboot, so recreate it at every session start.
cat > /tmp/baden-my-project << 'SCRIPT'
#!/bin/bash
# Always exit 0 so a failed report never blocks the agent
curl -s -m 3 -X POST "${BADEN_API_URL:-http://localhost:3800}/api/query" \
  -H 'Content-Type: application/json' \
  -d "{\"projectName\":\"my-project\",$1}" || true
exit 0
SCRIPT
chmod +x /tmp/baden-my-project
```

**2. `.claude/settings.json`** — run the hook at every session start and allow the wrapper.
This can live alongside the compaction hook from Phase 6 in `settings.local.json`; hooks from both files run.

```json
{
  "permissions": {
    "allow": ["Bash(/tmp/baden-my-project:*)"]
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/setup-baden.sh" }
        ]
      }
    ]
  }
}
```

**3. Add this section to `.claude/agents/rule-guard.md`**

````markdown
## Reporting to Baden

Report every verification step to Baden with Bash through `/tmp/baden-my-project`.
If the wrapper is missing, skip reporting and say so in your result — never block verification on reporting.

- Include a `ruleId` in every report, and report each rule separately (one `ruleId` per report)
- Always include the `taskId` passed in by the calling agent

```bash
# Applicable rule
/tmp/baden-my-project '"action":"check_rule","ruleId":"C1","target":"src/api/users.ts","reason":"C1 applies: file under src/api/**","taskId":"..."'
# Result per rule
/tmp/baden-my-project '"action":"rule_pass","ruleId":"C1","target":"src/api/users.ts","reason":"MUST: ... — compliant","taskId":"..."'
/tmp/baden-my-project '"action":"rule_violation","ruleId":"C1","target":"src/api/users.ts","reason":"MUST NOT: ... — line 42","severity":"high","taskId":"..."'
# Final verdict
/tmp/baden-my-project '"action":"review_pass","reason":"Pre-review complete: C1 passes","result":"PASS","taskId":"..."'
```

| Field | Description |
|---|---|
| `action` | `check_rule`, `rule_pass`, `rule_violation`, `review_pass`, `review_issue` |
| `ruleId` | ID of the rule being checked. May be omitted in the final verdict |
| `target` | File being checked |
| `reason` | Grounds for the verdict, quoting the MUST/MUST NOT text |
| `severity` | On violation: `critical`, `high`, `medium`, `low` |
| `result` | Final verdict: `PASS` or `ISSUE: summary` |
| `taskId` | The taskId passed in by the calling agent |
````

Also add the wrapper to the Bash allowance in rule-guard's Principles section
(for example: "Use Bash only for reporting to Baden (`/tmp/baden-my-project`) and for grep searches").

For a complete working example, see `.claude/agents/rule-guard.md` and `.claude/hooks/setup-baden.sh` in the Baden repository.

### 7-4. INDEX.yaml Integration

Baden parses the project's `rules/INDEX.yaml` and registers rule metadata. The reference/violation/fix frequency of each rule is tracked on the dashboard.
Keep the `## MUST`, `## MUST NOT`, and `## PREFER` headings in English — Baden counts the bullets under them.

### 7-5. Verify

Ask the user to start a new Claude Code session (so the SessionStart hook runs) and give any task that modifies code. Then check:

- Events appear on the project's **Monitor** page in real time
- **Analysis → Rules** lists the rules from `INDEX.yaml`
- Rule Guard's reports appear in the **Rules** lane with rule IDs, linked to the same task

---

## Checklist

```
Phase 1: Project Analysis
  [ ] Structure understood
  [ ] Pattern exploration complete
  [ ] Static analysis coverage checked
  [ ] _analysis.md written

Phase 2: Rule System Design
  [ ] rules/ directory created
  [ ] INDEX.yaml draft written
  [ ] Tier structure decided

Phase 3: Writing Rules
  [ ] principles.md (6 or fewer)
  [ ] Concerns C1~Cn (9 or fewer recommended)
  [ ] Specifics S-* (core domains only)
  [ ] INDEX.yaml trigger mapping complete

Phase 4: Initial Audit
  [ ] AUDIT-v1 run
  [ ] Violation list organized
  [ ] Exception judgment complete
  [ ] Compliance rate calculated

Phase 5: Refactoring
  [ ] Tracks split
  [ ] Critical/High resolved
  [ ] AUDIT-v2 run
  [ ] Critical 0, High 0 achieved

Phase 6: Rule Guard
  [ ] .claude/agents/rule-guard.md created
  [ ] Rule Guard instructions added to CLAUDE.md
  [ ] Context compaction hook configured

Phase 7: Baden Integration
  [ ] Project registered with Rules Path, MCP server registered (by the user)
  [ ] Baden Monitoring block copied into CLAUDE.md, taskId line added to Rule Guard section
  [ ] SessionStart hook + wrapper created, allowed in .claude/settings.json
  [ ] Reporting section added to rule-guard.md
  [ ] Events, rules, and Rule Guard reports visible in the dashboard
```

---

## Reference: Approach by Project Maturity

**New project (no code)**
- Skip Phase 1; start from Phase 2
- Before writing code, write only principles.md and the core Concerns first
- Add Specifics incrementally as code accumulates
- Phases 4–5 (audit/refactoring) are unnecessary

**Early-stage project (~10K lines)**
- Perform Phase 1 quickly
- Codify only the main patterns as rules (3–5 Concerns, 2–3 Specifics)
- After a light audit, move straight to normal operation

**Mature project (~50K+ lines)**
- Perform Phase 1 thoroughly
- Apply the full Tier structure
- A full audit + systematic refactoring are required
- Baden integration recommended (compliance is hard to maintain without behavioral observation)
