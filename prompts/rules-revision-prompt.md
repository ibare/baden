**English** | [한국어](./rules-revision-prompt.ko.md)

# Rules Revision — Industry Top-Tier Baseline

Audit and revise the existing rule system. The judgment baseline is determined by a grade (S/A/B/C/D) derived from the service profile, and security and personal data handling are held to a standard at least one level stricter than the general baseline.

---

## Principles

- Read every rule file. Do not infer.
- Read the code directly and compare it against the rules. Do not assume the code is good just because rules exist.
- State industry baselines concretely. Do not use vague standards on the level of "generally good practice."
- Every rule change proposal MUST include code evidence (file, line, pattern).

---

## Step 0: Service Classification and Baseline Setting

Identify the service characteristics of the project and determine the appropriate baseline level. The baseline varies with the scale and nature of the service.

### 0-1. Write the Service Profile

Determine the items below from the code and configuration. **Do not fill them in by guessing. Ask the user about any item you cannot determine with confidence.**

```
## Service Profile

### Product Domain
- Domain: (e.g., B2B SaaS, EdTech, FinTech, Healthcare, E-commerce, Social, Gaming, etc.)
- Product type: (e.g., web app, mobile app, API service, data pipeline, embedded, etc.)

### Service Scale
- Target user scope: (e.g., internal tool, specific group, single country, multi-country, global)
- Expected/actual number of users: (e.g., <1K, 1K~10K, 10K~100K, 100K~1M, 1M+)
- Traffic level: (e.g., low, medium, high, very high)
- Service stage: (e.g., MVP/prototype, early operation, growth, large-scale operation)

### Data Characteristics
- Data handled: (e.g., general, personal data, payment data, health data, children's data)
- Data residency requirements: (e.g., none, single country, EU, multi-region)
- Data volume: (e.g., GB or less, TB scale, PB scale)

### Regulatory Environment
- Applicable regulations: (e.g., none, PIPA (Korea's Personal Information Protection Act), GDPR, HIPAA, PCI-DSS, SOC2, COPPA, etc.)
- Certifications/compliance: (e.g., none, ISO 27001, SOC2 Type II, etc.)
- Audit requirements: (e.g., none, internal audit, external audit, periodic regulatory audit)
```

**Items you must confirm with the user:**
- If the target user scope and expected number of users cannot be determined from the code, you MUST ask.
- If the applicable regulations are unclear, you MUST ask. Do not guess regulations.
- The baseline changes significantly depending on the service stage (MVP vs. in operation), so you MUST confirm it.

### 0-2. Determine the Service Grade

Map the profile results onto the grade table below:

| Grade | Service Characteristics | General Baseline | Security/Privacy Baseline |
|:----:|-----------|:--------:|:--------------:|
| **S** | Global service, 1M+ users, payment/health/financial data, subject to regulatory audit | Top 1% | Top 0.5% |
| **A** | Multi-country or large-scale single country, 100K+ users, includes personal data, GDPR/PIPA applies | Top 3% | Top 1% |
| **B** | Single country, targets a specific user group, 10K+ users, includes personal data | Top 5% | Top 3% |
| **C** | Internal tool or small-scale service, <10K users, mostly general data | Top 10% | Top 5% |
| **D** | MVP/prototype, validation stage, pre-launch | Top 20% | Top 10% |

**Grade escalation conditions** (if any one applies, raise the grade by one level):
- Handles children's data (COPPA, etc.)
- Processes payment information directly (PCI-DSS)
- Handles health/medical information (HIPAA)
- Serves government/public institutions
- A service outage affects physical safety

**Report the grade decision to the user and get confirmation.** If the user adjusts the grade, follow it.

### 0-3. Define Baselines per Grade

Define concrete baselines for each area according to the determined grade. Take the project's tech stack and domain into account.

#### Architecture

| Grade S/A | Grade B | Grade C/D |
|---------|-------|---------|
| Clear layer separation + enforced domain boundaries | Layer separation + domain directory separation | Basic separation of concerns |
| API versioning required | API versioning recommended | Not required |
| Contract tests between services | Integration tests | Basic tests |
| Distributed tracing + structured logging | Structured logging | Basic logging |

#### Code Quality

| Grade S/A | Grade B | Grade C/D |
|---------|-------|---------|
| Test coverage 80%+ | Tests required for core logic | Tests for major features |
| Zero circular dependencies | Minimize circular dependencies | No obvious circular dependencies |
| Static analysis in CI required + zero warnings | Static analysis in CI required | Static analysis configured |
| 100% type safety | 95%+ type safety | Type definitions for core interfaces |

#### Error Handling

| Grade S/A | Grade B | Grade C/D |
|---------|-------|---------|
| Structured error hierarchy + per-domain classification | Custom error classes + consistent format | Error propagation + basic classification |
| Retry/circuit breaker required | Retry recommended for external calls | Basic timeouts |
| Integrated with an error reporting system | Systematized error logging | Error logging |

#### Security (differentiated by grade)

| Grade S | Grade A | Grade B | Grade C/D |
|-------|-------|-------|---------|
| PII encryption at rest + in transit + field level | PII encryption at rest + in transit | PII encryption in transit + hashing of sensitive fields | Basic HTTPS |
| Full audit logs + tamper protection | Full audit logs | Logging of sensitive operations | Error logging |
| Automatic secret rotation | Use of a secret manager | Separate environment variables | Separate .env |
| Automated dependency scanning + SBOM | Automated dependency scanning | Manual review | Check for known vulnerabilities |
| Regular penetration testing | Security code review | Basic input validation | Basic input validation |
| Data retention/deletion policy enforced in code | Soft delete + grace period policy | Soft delete | Consistent deletion method |

#### Personal Data (differentiated by grade)

| Grade S | Grade A | Grade B | Grade C/D |
|-------|-------|-------|---------|
| Full application of Privacy by Design | Maintain an inventory of personal data processing | Identify personal data | Basic awareness |
| Data minimization principle enforced in code | Rule prohibiting collection of unnecessary data | State the purpose of collection | - |
| Automatic deletion pipeline on consent withdrawal | Deletion request handling process | Deletion API | - |
| Enforced multi-region data residency | Data residency configuration | - | - |
| Appoint a DPO + conduct a DPIA | Privacy impact assessment | - | - |

---

## Step 1: Read All Existing Rules

### 1-1. Read Every Rule File

```bash
# Understand the rule structure
find rules/ -type f -name "*.md" | sort

# Read INDEX.yaml
cat rules/INDEX.yaml

# Read all rule files (one at a time)
cat rules/principles.md
cat rules/concerns/*.md
cat rules/specifics/*.md
```

### 1-2. Write the Rule Inventory

```markdown
## Rule Inventory

| ID | Tier | Name | MUST count | MUST NOT count | PREFER count | last_verified |
|----|------|------|:-------:|:-----------:|:---------:|:-------------:|
| principles | T1 | Core principles | X | X | X | date |
| C1 | T2 | ... | X | X | X | date |
| S-xxx | T3 | ... | X | X | X | date |

Total rule files: X
Total MUST items: X
Total MUST NOT items: X
```

---

## Step 2: Rule Coverage Analysis

### 2-1. Trigger Match Coverage

Measure how much of the actual codebase the triggers in INDEX.yaml cover.

```bash
# Total number of source files
TOTAL=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" \) -not -path '*/node_modules/*' -not -path '*/dist/*' | wc -l)

# Number of matching files per paths trigger in INDEX.yaml
# (run each trigger as a glob and count)

# List of files that match no trigger at all
# (all files - union of all trigger matches)
```

```markdown
## Trigger Coverage

- Total source files: X
- Trigger-matched files: X (X%)
- **Uncovered files: X (X%)**

### Uncovered File List
| File | Directory | Presumed Domain |
|------|---------|-----------|
| ... | ... | ... |
```

### 2-2. Rule Content Coverage

Identify areas that the current rules do not cover relative to the grade baseline determined in Step 0.

```markdown
## Uncovered Areas vs. Baseline

### General Baseline Not Met (Grade X baseline)
| # | Area | Grade Baseline | Current Rule | Gap |
|---|------|---------|---------|-----|
| 1 | (e.g., distributed tracing) | (baseline for the grade) | None | No rule exists at all |
| 2 | (e.g., API versioning) | (baseline for the grade) | Partially mentioned in C3 | No MUST item |

### Security/Privacy Baseline Not Met (Grade X security baseline)
| # | Area | Grade Baseline | Current Rule | Gap | Severity |
|---|------|---------|---------|-----|:--------:|
| 1 | (e.g., PII encryption) | (security baseline for the grade) | None | Critical |
| 2 | (e.g., audit logs) | (security baseline for the grade) | Partial | High |
```

---

## Step 3: Existing Rules vs. Actual Code

Compare each rule's MUST/MUST NOT items against the actual code. Check two things at the same time:
- Is the rule being followed? (search for violations)
- Is the rule still appropriate for the current code? (validity of the rule itself)

### 3-1. Compare Code per Rule

For each rule:

1. Read the rule file
2. For each MUST/MUST NOT item, search for compliance/violation patterns with grep/search
3. Assign one of the following verdicts:

| Verdict | Meaning |
|------|------|
| **EFFECTIVE** | The rule is being followed and is still valid |
| **VIOLATED** | The rule exists but there are violations |
| **STALE** | The code has already evolved beyond the rule (the rule is outdated) |
| **OBSOLETE** | The rule no longer has anything to apply to (technology/structure changed) |
| **WEAK** | The rule exists but falls short of the grade baseline |
| **CONFLICTING** | Conflicts with another rule |

```markdown
## Per-Rule Audit Results

| ID | Item | Verdict | Evidence (file:line) | Notes |
|----|------|:----:|--------------|------|
| C1 | MUST: named export | EFFECTIVE | Checked all 312 files | |
| C1 | MUST NOT: export default | VIOLATED | src/pages/Home.tsx:1 | Violation; not a React.lazy exception |
| C3 | MUST: rethrow errors | WEAK | Rethrows, but error types are not classified | Falls short of grade baseline |
| S-xxx | MUST: ... | STALE | The module was refactored to v2 | Rule needs updating |
| S-yyy | All | OBSOLETE | The library was removed | Candidate for rule deletion |
```

### 3-2. Special Security/Privacy Audit

Audit separately against the security/privacy baseline for the grade. For these items, inspect the code directly regardless of whether existing rules cover them.

```bash
# Search for PII fields
grep -rn "email\|phone\|address\|birthdate\|ssn\|national_id\|resident_id\|mobile" --include="*.ts" --include="*.py" | grep -v node_modules | grep -v test

# Encryption
grep -rn "encrypt\|decrypt\|hash\|bcrypt\|argon\|aes\|crypto" --include="*.ts" --include="*.py" | grep -v node_modules

# Access logging
grep -rn "audit\|access.log\|activity.log" --include="*.ts" --include="*.py" | grep -v node_modules

# Hard delete vs. soft delete
grep -rn "DELETE FROM\|\.delete(\|\.destroy(\|\.remove(" --include="*.ts" --include="*.py" | grep -v node_modules | grep -v test

# Secret exposure
grep -rn "password.*=.*['\"].\{8,\}\|api.key.*=.*['\"].\{8,\}\|secret.*=.*['\"].\{8,\}" --include="*.ts" --include="*.py" --include="*.env" | grep -v node_modules | grep -v test | grep -v example
```

```markdown
## Security/Privacy Audit (Grade X security baseline)

| # | Area | Baseline | Current State | Severity | Evidence |
|---|------|------|---------|:--------:|------|
| SEC-1 | PII encryption | All PII encrypted at rest | email stored in plaintext | Critical | models/user.ts:45 |
| SEC-2 | Audit logs | Log all PII access | No logging | Critical | |
| SEC-3 | Hard delete | PII uses soft delete + purge after grace period | Hard deletes exist | High | user.service.ts:89 |
| SEC-4 | Secrets | Zero secrets in code | API key in .env | Medium | .env:12 |
```

---

## Step 4: Write the Change List

Combine the results of Steps 2 and 3 into a list of rule changes.

### 4-1. Rules to Add

Derive these from coverage gaps and unmet higher-level baselines.

```markdown
## Rules to Add

| # | Proposed ID | Tier | Name | Rationale | Priority |
|---|---------|------|------|------|:--------:|
| 1 | C10-audit-logging | T2 | Audit logging | Grade security baseline not met. No PII access logging at all | Critical |
| 2 | C11-data-retention | T2 | Data retention/deletion | GDPR requirement. 3 hard deletes found | Critical |
| 3 | S-xxx | T3 | ... | 23 uncovered files are concentrated in this domain | High |

Write a MUST/MUST NOT draft for each proposal:

### C10-audit-logging draft
## MUST
- Record audit logs for reads/writes/deletes of data containing personal information
- Audit logs include who (userId), when (timestamp), what (target), and which action (action)
- ...

## MUST NOT
- Do not include raw PII values in audit logs (masking required)
- ...
```

### 4-2. Rules to Remove

List the rules with an OBSOLETE verdict.

```markdown
## Rules to Remove

| # | ID | Name | Rationale |
|---|-----|------|------|
| 1 | S-yyy | ... | The library was removed. 0 files match the trigger. |
```

### 4-3. Rules to Revise

List the rules with a STALE, WEAK, or CONFLICTING verdict and propose the direction of revision.

```markdown
## Rules to Revise

| # | ID | Verdict | Current | Revision Direction | Priority |
|---|-----|:----:|------|---------|:--------:|
| 1 | C3 | WEAK | Only requires rethrowing errors | Add requirements for an error type hierarchy + structure (grade baseline) | High |
| 2 | S-xxx | STALE | Based on the v1 API | Reflect the v2 API structure | Medium |
| 3 | C1 vs S-zzz | CONFLICTING | MUST in C1 conflicts with MUST in S-zzz | Specify precedence or add an exception | Medium |

Write a change diff for each revision:

### C3 revision proposal
## MUST (added)
+ Define custom error classes and classify them by domain
+ Separate the error code (string) and the user message in error responses

## MUST (changed)
- Always rethrow errors after catching them
+ Always wrap errors in an appropriate error type and rethrow them after catching

## MUST NOT (added)
+ Do not throw a generic Error or a bare string
```

### 4-4. Update INDEX.yaml

List the items that require trigger changes.

```markdown
## INDEX.yaml Updates

| # | Rule ID | Change Type | Details |
|---|---------|---------|------|
| 1 | C10 (new) | Add | paths: ["**/models/**", "**/services/**"], patterns: ["PII", "personal"] |
| 2 | S-yyy (deleted) | Remove | Delete all triggers |
| 3 | S-xxx (revised) | Modify | Add "v2/" path to paths |
```

---

## Step 5: Prioritization and Execution Plan

### 5-1. Change Priorities

```markdown
## Execution Priorities

### P0 — Execute immediately (security/privacy, grade security baseline not met)
| # | Type | ID | Details |
|---|------|-----|------|
| 1 | Add | C10-audit-logging | Create audit logging rule |
| 2 | Add | C11-data-retention | Create data retention/deletion rule |

### P1 — This cycle (general grade baseline not met, High)
| # | Type | ID | Details |
|---|------|-----|------|
| 1 | Revise | C3 | Strengthen error handling |
| 2 | Add | S-xxx | Rule for uncovered domain |

### P2 — Next cycle (Medium, trigger cleanup)
| # | Type | ID | Details |
|---|------|-----|------|
| 1 | Remove | S-yyy | Delete unused rule |
| 2 | Revise | S-xxx | Reflect v2 |
| 3 | Update | INDEX.yaml | Clean up triggers |
```

### 5-2. Execution Method

- P0: Create/modify rule files → full audit → refactor to resolve violations
- P1: Modify rule files → audit related code → refactor if needed
- P2: Modify/delete rule files → update INDEX.yaml → verify indexing

---

## Step 6: Write the Report

```markdown
# Rules Revision Report

## Baseline
- Product domain: (domain)
- Service grade: (S/A/B/C/D)
- General baseline: (baseline for the grade)
- Security/privacy baseline: (security baseline for the grade)
- Audit date: (date)

## Current State
- Rule files: X (Principles X, Concerns X, Specifics X)
- MUST/MUST NOT items: X
- Trigger coverage: X%
- Uncovered files: X

## Audit Result Summary
- EFFECTIVE: X items
- VIOLATED: X items
- STALE: X items
- OBSOLETE: X items
- WEAK: X items (below grade baseline)
- CONFLICTING: X items

## Special Security/Privacy Audit
- Grade security baseline not met: X cases (Critical X, High X)

## Change Plan
- Rules to add: X
- Rules to remove: X
- Rules to revise: X
- INDEX.yaml updates: X

## Execution Priorities
- P0 (immediate): X
- P1 (this cycle): X
- P2 (next cycle): X

## Details
(Full contents of Step 4)
```

---

## Cautions

- The baseline follows the **service grade** determined in Step 0. The grade decision goes through user confirmation. Once the grade is decided, apply its baseline consistently.
- When proposing new rules, **exclude items that static analysis can cover**. This system focuses on areas that only an LLM can judge.
- Confirm STALE/OBSOLETE verdicts by **reading the code directly**. Do not judge based solely on the last_verified date in the rule file.
- Split large codebases into batches. Do not process the entire codebase in a single session.
- Revision proposals are **drafts**. Get user review before final confirmation.
