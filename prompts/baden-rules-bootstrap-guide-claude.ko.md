[English](./baden-rules-bootstrap-guide-claude.md) | **한국어**

# Baden Rules Bootstrap Guide

새 프로젝트 또는 진행 중인 프로젝트에 규칙 기반 AI 에이전트 개발 파이프라인을 구축하기 위한 표준 지침.

## 왜 Rules인가

AI 코딩 에이전트는 코드를 실제로 읽지 않고 추론으로 대체하며, 자기가 규칙을 따랐다고 스스로 확신한다. 문서는 코드와 괴리가 생기고 유지보수 자체가 부담이 된다. 코드가 스스로를 설명하게 하려면 일관된 품질과 구조가 필요하고, 그 일관성을 유지하는 뼈대가 규칙이다.

단, 규칙이 커버하는 영역은 명확히 구분해야 한다:

- **정적 분석 도구** (ESLint, Pylint, RuboCop, Checkstyle, clippy, golangci-lint 등): 기계적으로 검증 가능한 것 (unused imports, 포매팅, 네이밍 컨벤션, 타입 검사 등)
- **Rules (이 시스템)**: 의미와 맥락이 필요한 것 (설계 패턴 준수, 도메인 로직 제약, 의존성 방향, 아키텍처 원칙)

정적 분석 도구가 잡을 수 있는 것은 정적 분석에 맡긴다. 빠르고, 싸고, 100% 일관되고, 누락이 없다. Rules는 LLM만이 판단할 수 있는 영역에 집중한다.

---

## Phase 1: 프로젝트 분석

### 1-1. 구조 파악

프로젝트의 전체 구조를 파악한다. 아래 항목을 조사해 `rules/_analysis.md`에 기록한다:

```
## 프로젝트 구조 분석

### 기본 정보
- 언어:
- 주요 프레임워크/라이브러리:
- 모노레포 여부:
- 모듈/패키지/앱 목록:
- 빌드 시스템:
- 테스트 프레임워크:
- 사용 중인 정적 분석 도구:

### 규모
- 소스 파일 수:
- 대략적 코드 라인 수:
- DB 모델/테이블 수 (해당 시):
- API 엔드포인트 수 (해당 시):

### 핵심 도메인
- 도메인 1: (설명)
- 도메인 2: (설명)
- ...
```

### 1-2. 패턴 탐색

코드베이스에서 반복되는 패턴과 안티패턴을 탐색한다. 프로젝트의 주 언어에 맞는 도구와 검색 패턴을 사용한다:

```bash
# 디렉터리 구조 파악
find . -type f -name "*.{주 언어 확장자}" | head -100

# 의존성/import 패턴
grep -r "import\|require\|include\|use\|from" --include="*.{확장자}" | head -50

# 인스턴스 생성 패턴 (싱글턴 위반 후보)
grep -rn "new \|::new\|\.create(\|getInstance\|\.build(" --include="*.{확장자}" | head -30

# 에러 처리 패턴
grep -rn "try\|catch\|except\|rescue\|throw\|raise\|panic" --include="*.{확장자}" | head -30

# public API / export 패턴
grep -rn "export\|public\|pub fn\|module\.exports\|__all__" --include="*.{확장자}" | head -30
```

관찰 결과를 `rules/_analysis.md`에 추가한다:

```
### 발견된 공통 패턴
- (예: DB 클라이언트를 각 파일에서 직접 생성하고 있음)
- (예: 에러를 catch 후 로깅만 하고 재전파하지 않음)
- (예: 설정값이 여러 파일에 하드코딩되어 있음)

### 발견된 안티패턴
- (예: 핸들러/컨트롤러에 비즈니스 로직이 200줄 이상 직접 작성됨)
- (예: 동일 기능의 유틸 함수가 여러 곳에 중복 구현됨)
```

### 1-3. 정적 분석 현황 확인

프로젝트에서 사용 중인 정적 분석 도구의 설정을 확인하고, 기계적으로 커버되는 영역을 파악한다. 정적 분석으로 커버되는 항목은 Rules에 중복 작성하지 않는다.

정적 분석 도구가 아직 없다면 프로젝트 언어에 맞는 도구 도입을 권장한다. 기계적 검증은 기계에 맡기는 것이 원칙이다.

---

## Phase 2: 규칙 체계 설계

### 디렉터리 구조

```
rules/
├── INDEX.yaml              # 트리거 매핑 (어떤 파일에 어떤 규칙 적용)
├── principles.md           # Tier 1: 모든 코드에 적용되는 핵심 원칙
├── concerns/               # Tier 2: 횡단 관심사 (C1, C2, ...)
│   ├── C1-{이름}.md
│   ├── C2-{이름}.md
│   └── ...
├── specifics/              # Tier 3: 도메인별 규칙 (S-*)
│   ├── S-{도메인}.md
│   └── ...
└── _analysis.md            # 분석 기록 (규칙이 아님, 작업 후 삭제 가능)
```

### 3 Tier 구조

**Tier 1 — Principles (principles.md)**

모든 코드에 항상 적용되는 핵심 원칙. 6개 이하로 유지한다. 프로젝트의 언어와 아키텍처에 맞게 정의한다. 예시:

```markdown
# Principles

## 1. 단일 책임
- 하나의 함수/클래스/모듈은 하나의 역할만 수행한다

## 2. 의존성 방향
- 상위 모듈이 하위 모듈을 의존한다. 역방향 금지.

## 3. 공유 인스턴스 재사용
- 싱글턴/공유 객체로 관리되는 인스턴스를 직접 생성하지 않는다

## 4. 중앙 집중 관리
- 설정, 상수, 에러코드는 중앙에서 관리한다

## 5. 최소 범위 변경
- 수정은 필요한 범위로 최소화한다. 부수효과 금지.

## 6. 타입/계약 안전
- 함수의 입출력 계약을 명확히 한다. 암묵적 변환이나 동적 타입 남용 금지.
```

**Tier 2 — Concerns (concerns/C*.md)**

여러 도메인에 걸쳐 적용되는 횡단 관심사. 각 파일은 아래 형식을 따른다:

```markdown
---
version: 1
last_verified: (날짜)
---

# (규칙 이름) (ID)

## When to Apply
(이 규칙이 적용되는 상황)

## MUST
- (반드시 해야 하는 것)

## MUST NOT
- (절대 하면 안 되는 것)

## PREFER
- (권장 사항, 위반 판정 대상 아님)
```

**Tier 3 — Specifics (specifics/S-*.md)**

특정 도메인/기술에만 적용되는 규칙. 같은 형식을 따른다.

### INDEX.yaml 설계

트리거 매핑 파일. 어떤 파일을 수정할 때 어떤 규칙을 로드할지 정의한다:

```yaml
# rules/INDEX.yaml
# Rule Registry — 트리거 조건에 따라 로드할 규칙 결정
#
# Trigger types:
#   paths:    파일 경로 glob 패턴
#   patterns: 코드에서 발견되는 문자열/정규식
#   imports:  import/include/require 문에 포함된 모듈명
#   events:   작업 유형 (create-file, rename-file 등)

# ─────────────────────────────────────
# Always loaded
# ─────────────────────────────────────
always:
  - file: principles.md
    description: 모든 코드에 적용되는 핵심 원칙

# ─────────────────────────────────────
# Concerns (Cross-cutting)
# ─────────────────────────────────────
concerns:
  - id: C1
    file: concerns/C1-{이름}.md
    description: (설명)
    triggers:
      events: [create-file, rename-file]
      patterns: ["(프로젝트에 맞는 패턴)"]

# ─────────────────────────────────────
# Specifics (Domain-specific)
# ─────────────────────────────────────
specifics:
  - id: S-{도메인}
    file: specifics/S-{도메인}.md
    description: (설명)
    triggers:
      paths: ["**/해당/경로/**"]
      imports: ["(관련 모듈명)"]
```

---

## Phase 3: 규칙 작성

### 3-1. Principles 작성

Phase 1의 분석 결과를 바탕으로 프로젝트에 맞는 핵심 원칙을 작성한다. 6개 이하로 유지한다. 프로젝트의 기존 코드에서 이미 따르고 있는 좋은 패턴을 원칙으로 격상시킨다.

### 3-2. Concerns 작성

횡단 관심사를 식별한다. 언어와 프레임워크에 따라 다르지만, 일반적으로 아래 영역에서 나온다:

- 파일/디렉터리 구조와 네이밍
- 공유 자원 관리 (DB 연결, HTTP 클라이언트, 캐시 등)
- 에러 처리와 전파
- 하드코딩 금지 (설정/상수 중앙 관리)
- 로깅과 모니터링
- 보안 (인증, 권한, 입력 검증)
- 테스트 작성 원칙

각 Concern에 대해:
1. 코드베이스에서 관련 패턴을 검색으로 조사
2. 좋은 패턴과 안티패턴을 수집
3. MUST / MUST NOT 으로 명문화
4. INDEX.yaml에 트리거 조건 등록

### 3-3. Specifics 작성

도메인별 규칙을 작성한다. 프로젝트의 핵심 도메인 각각에 대해:
1. 해당 도메인의 코드를 읽고 설계 패턴을 파악
2. 도메인 고유의 제약사항을 MUST / MUST NOT으로 정의
3. INDEX.yaml에 paths/imports/patterns 트리거 등록

### 작성 원칙

- **MUST/MUST NOT만 검증 대상이다.** PREFER는 권장일 뿐 위반으로 판정하지 않는다.
- **정적 분석 도구가 잡을 수 있는 것은 쓰지 않는다.** 의미와 맥락이 필요한 것만 쓴다.
- **구체적으로 쓴다.** "좋은 코드를 작성하라"가 아니라 "핸들러에 50줄 이상의 비즈니스 로직을 직접 작성하지 마라"로 쓴다.
- **코드베이스의 현실을 반영한다.** 이상적인 규칙이 아니라 이 프로젝트에서 실제로 지켜야 하는 것을 쓴다.
- **규칙 수를 통제한다.** Concern 9개 이하, Specific은 핵심 도메인만.

---

## Phase 4: 초기 감사 (Audit)

규칙 작성이 완료되면 현재 코드베이스를 전수 감사한다.

### 4-1. 감사 계획

```markdown
## AUDIT-v1 계획

### 목적
rules/ 규칙 기준으로 전체 코드베이스의 현재 준수율을 측정한다.

### 감사 범위
전수 감사. 모든 소스 파일을 대상으로 한다.

### 배치 분할 (컨텍스트 관리를 위해)
- Batch 1: Principles + Concerns C1~C(n)
- Batch 2: Specifics S-*
- (필요시 추가 배치)

### 세션 전략
배치당 1세션. 감사 결과는 rules/_audit-v1.md에 기록한다.
```

### 4-2. 감사 실행

각 배치에서:
1. 해당 규칙 파일을 읽는다
2. 관련 코드를 검색으로 전수 확인한다
3. MUST/MUST NOT 위반을 기록한다
4. 위반마다 severity를 판정한다: Critical / High / Medium / Low

### 4-3. 감사 결과 형식

```markdown
## AUDIT-v1 결과

### 요약
- 총 위반: X건
- Critical: X건 / High: X건 / Medium: X건 / Low: X건
- 준수율: X%

### 위반 목록
| # | 규칙 | 파일 | Severity | 내용 |
|---|------|------|:--------:|------|
| 1 | C2 | (파일 경로) | High | (위반 내용) |
| 2 | S-api | (파일 경로) | Medium | (위반 내용) |
```

### 4-4. 예외 판정

감사 중 "위반이지만 수정할 수 없는 것"을 분류한다:
- 프레임워크/라이브러리가 요구하는 패턴
- 성능 이유로 의도적인 설계
- 마이그레이션 비용이 가치를 초과하는 경우

예외는 해당 규칙 파일에 `**Exception**`으로 명시한다.

---

## Phase 5: 리팩토링

감사 결과를 바탕으로 위반을 해소한다.

### 5-1. Track 분할

위반을 유형별로 Track으로 분류한다:

```markdown
Track A: 기계적 수정 (rename, import 정리, 포맷 통일 등)
Track B: 구조 수정 (책임 분리, 서비스 추출, 모듈 분할 등)
Track C: 도메인 수정 (도메인 고유 규칙 위반 해소)
Track D: 최종 감사 (AUDIT-v2)
```

### 5-2. 실행 원칙

- Critical → High → Medium → Low 순서로 해소
- Track별로 독립 세션에서 진행
- 각 Track 완료 후 빌드/테스트 통과 확인
- Rule Guard가 설정되어 있다면 사전/사후 검증 수행

### 5-3. 최종 감사

리팩토링 완료 후 AUDIT-v2를 실행해 준수율을 재측정한다. Critical 0, High 0이 목표.

---

## Phase 6: Rule Guard 설정

### 에이전트 정의

`.claude/agents/rule-guard.md`:

```markdown
---
name: rule-guard
description: 코드 수정 전과 후에 호출한다. rules/ 디렉터리의 규칙을 기준으로 수정 계획 또는 수정 결과가 MUST/MUST NOT 항목을 위반하지 않는지 검증한다.
tools: Read, Glob, Grep, Bash
---

# Rule Guard

코드 수정의 규칙 준수 여부를 검증하는 서브에이전트.
코드를 수정하지 않는다. 읽기, 검색, 보고만 수행한다.

## 호출 시점

1. **사전 검토**: 수정 계획이 수립되면, 수정을 실행하기 전에 호출한다
2. **사후 검증**: 수정이 완료되면, 실제 코드가 규칙을 준수하는지 호출한다

## 검증 절차

### 사전 검토
1. 수정 대상 파일 목록을 확인한다
2. rules/INDEX.yaml에서 각 파일에 적용되는 규칙을 확인한다
3. 해당 규칙 파일을 읽는다
4. 수정 계획이 MUST / MUST NOT 항목을 위반하지 않는지 확인한다
5. 판정 결과를 반환한다 → PASS 시 수정 진행 / ISSUE 시 계획 수정

### 사후 검증
1. 수정된 파일을 읽는다
2. 규칙 기준으로 실제 코드를 검증한다
3. grep으로 위반 패턴이 잔존하지 않는지 전수 확인한다
4. 판정 결과를 반환한다 → PASS 시 다음 작업 / ISSUE 시 재수정

## 원칙

- MUST / MUST NOT 위반만 판정한다. PREFER는 판정하지 않는다.
- 규칙 파일을 추론하지 않는다. 반드시 읽고 판정한다.
- 규칙 파일을 수정하지 않는다.
- 코드를 수정하지 않는다. 파일 쓰기를 수행하지 않는다.
- Bash는 보고와 grep 검색에만 사용한다.
- 규칙에 명시되지 않은 사항은 위반으로 판정하지 않는다.
```

### CLAUDE.md에 추가

```markdown
## Rule Guard
- 코드 수정 시 rule-guard 서브에이전트를 두 번 호출한다:
  1. 수정 계획 수립 후, 실행 전 → 사전 검토
  2. 수정 완료 후 → 사후 검증
- task_complete 보고 전에 반드시 빌드/테스트를 통과할 것
- 서브에이전트에 복합 작업을 위임하지 말 것. 작업 단위를 분리하여 각각 호출할 것

## 구현 원칙
- rules/ 디렉터리에 구현 규칙이 정의되어 있다
- rules/INDEX.yaml에서 현재 작업에 적용되는 규칙을 확인한다
- MUST/MUST NOT 위반은 금지한다
- 규칙 파일을 먼저 읽는다. 추론하지 않는다.
- 규칙 파일을 수정하지 않는다
```

### 컨텍스트 컴팩션 대응

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
            "command": "echo '⚠️ 컨텍스트 컴팩션 발생. 아래 지침을 다시 숙지하고 준수할 것.' && echo '\\n=== CLAUDE.md ===' && cat CLAUDE.md && echo '\\n=== rule-guard ===' && cat .claude/agents/rule-guard.md"
          }
        ]
      }
    ]
  }
}
```

---

## Phase 7: Baden 연동 (선택)

Baden을 사용하면 규칙 준수 여부가 실시간으로 관측 가능해진다.
셋업 절차의 기준 문서는 Baden README다
([프로젝트 셋업](../README.ko.md#프로젝트-셋업)). 이 단계는 그 절차를 방금 셋업한 프로젝트에 적용한다.

### 7-1. 사전 준비 (사용자가 수행)

진행하기 전에 사용자에게 다음 항목을 확인받고, 등록한 프로젝트 이름을 알려 달라고 요청한다:

- Baden이 설치되어 실행 중이다 (`baden status`)
- Baden 대시보드에 프로젝트가 등록되어 있고, **Rules Path**가 이 프로젝트 `rules/` 디렉터리의 절대 경로로 설정되어 있다
- Baden MCP 서버가 Claude Code에 등록되어 있다 ([README — A-2](../README.ko.md#a-2-mcp-서버-등록))

### 7-2. CLAUDE.md에 Baden Monitoring 지침 추가

[README — A-3](../README.ko.md#a-3-모니터링-지침-추가)의 `## Baden Monitoring` 블록을 그대로 CLAUDE.md에 복사하고,
`Project Name`을 등록한 이름으로 설정한다. 내용을 고쳐 쓰지 않는다.

그다음 Phase 6에서 만든 `## Rule Guard` 섹션에 아래 한 줄을 추가한다:

```markdown
- rule-guard 를 호출할 때 현재 taskId 를 프롬프트에 반드시 포함할 것 (서브에이전트의 Baden 보고가 작업에 연결된다)
```

### 7-3. Rule Guard가 Baden에 보고하게 하기

도구가 제한된 서브에이전트는 `baden_*` MCP 도구를 호출하지 못할 수 있다.
그래서 Rule Guard는 SessionStart 훅이 만드는 래퍼 스크립트를 통해 HTTP로 보고한다
([README — 서브에이전트에서 보고하기](../README.ko.md#서브에이전트에서-보고하기)).
아래 예시의 `my-project`는 등록한 프로젝트 이름으로 바꾼다.

**1. `.claude/hooks/setup-baden.sh`** — 실행 권한을 준다 (`chmod +x`)

```bash
#!/bin/bash
# 서브에이전트가 HTTP로 Baden에 보고할 때 쓰는 래퍼를 만든다.
# /tmp는 재부팅 시 비워지므로 세션이 시작될 때마다 다시 만든다.
cat > /tmp/baden-my-project << 'SCRIPT'
#!/bin/bash
# 보고가 실패해도 에이전트를 막지 않도록 항상 0으로 종료한다
curl -s -m 3 -X POST "${BADEN_API_URL:-http://localhost:3800}/api/query" \
  -H 'Content-Type: application/json' \
  -d "{\"projectName\":\"my-project\",$1}" || true
exit 0
SCRIPT
chmod +x /tmp/baden-my-project
```

**2. `.claude/settings.json`** — 세션이 시작될 때마다 훅을 실행하고 래퍼를 허용한다.
Phase 6의 컴팩션 훅이 있는 `settings.local.json`과 함께 둬도 된다. 두 파일의 훅이 모두 실행된다.

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

**3. `.claude/agents/rule-guard.md`에 아래 섹션 추가**

````markdown
## Baden 보고

모든 검증 단계를 Bash로 `/tmp/baden-my-project`를 통해 Baden에 보고한다.
래퍼가 없으면 보고를 건너뛰고 결과에 그 사실을 밝힌다. 보고 때문에 검증을 멈추지 않는다.

- 모든 보고에 `ruleId`를 포함하고, 규칙마다 따로 보고한다 (보고 하나에 `ruleId` 하나)
- 호출한 에이전트가 넘겨준 `taskId`를 항상 포함한다

```bash
# 적용 대상 규칙
/tmp/baden-my-project '"action":"check_rule","ruleId":"C1","target":"src/api/users.ts","reason":"C1 적용: src/api/** 아래 파일","taskId":"..."'
# 규칙별 결과
/tmp/baden-my-project '"action":"rule_pass","ruleId":"C1","target":"src/api/users.ts","reason":"MUST: ... — 준수","taskId":"..."'
/tmp/baden-my-project '"action":"rule_violation","ruleId":"C1","target":"src/api/users.ts","reason":"MUST NOT: ... — 42행","severity":"high","taskId":"..."'
# 최종 판정
/tmp/baden-my-project '"action":"review_pass","reason":"사전 검토 완료: C1 통과","result":"PASS","taskId":"..."'
```

| 필드 | 설명 |
|---|---|
| `action` | `check_rule`, `rule_pass`, `rule_violation`, `review_pass`, `review_issue` |
| `ruleId` | 검사하는 규칙의 ID. 최종 판정에서는 생략할 수 있다 |
| `target` | 검사하는 파일 |
| `reason` | 판정 근거. MUST/MUST NOT 문구를 인용한다 |
| `severity` | 위반 시: `critical`, `high`, `medium`, `low` |
| `result` | 최종 판정: `PASS` 또는 `ISSUE: 요약` |
| `taskId` | 호출한 에이전트가 넘겨준 taskId |
````

rule-guard 원칙 섹션의 Bash 허용 범위에도 래퍼를 추가한다
(예: "Bash는 Baden 보고(`/tmp/baden-my-project`)와 grep 검색에만 사용한다").

실제로 동작하는 전체 예시는 Baden 저장소의 `.claude/agents/rule-guard.md`와 `.claude/hooks/setup-baden.sh`를 참고한다.

### 7-4. INDEX.yaml 연동

Baden은 프로젝트의 `rules/INDEX.yaml`을 파싱해 규칙 메타데이터를 등록한다. 규칙별 참조/위반/수정 빈도가 대시보드에서 추적된다.
`## MUST`, `## MUST NOT`, `## PREFER` 제목은 영어로 유지한다. Baden이 그 아래 항목 수를 센다.

### 7-5. 확인

사용자에게 새 Claude Code 세션을 시작하고(SessionStart 훅이 실행되도록) 코드를 수정하는 아무 작업이나 지시해 달라고 요청한다. 그다음 다음을 확인한다:

- 프로젝트의 **Monitor** 페이지에 이벤트가 실시간으로 나타난다
- **Analysis → Rules**에 `INDEX.yaml`의 규칙이 나열된다
- Rule Guard의 보고가 규칙 ID와 함께 **Rules** 레인에 나타나고, 같은 작업에 연결된다

---

## 체크리스트

```
Phase 1: 프로젝트 분석
  [ ] 구조 파악 완료
  [ ] 패턴 탐색 완료
  [ ] 정적 분석 현황 확인
  [ ] _analysis.md 작성

Phase 2: 규칙 체계 설계
  [ ] rules/ 디렉터리 생성
  [ ] INDEX.yaml 초안 작성
  [ ] Tier 구조 결정

Phase 3: 규칙 작성
  [ ] principles.md (6개 이하)
  [ ] Concerns C1~Cn (9개 이하 권장)
  [ ] Specifics S-* (핵심 도메인만)
  [ ] INDEX.yaml 트리거 매핑 완료

Phase 4: 초기 감사
  [ ] AUDIT-v1 실행
  [ ] 위반 목록 정리
  [ ] 예외 판정 완료
  [ ] 준수율 산출

Phase 5: 리팩토링
  [ ] Track 분할
  [ ] Critical/High 해소
  [ ] AUDIT-v2 실행
  [ ] Critical 0, High 0 달성

Phase 6: Rule Guard
  [ ] .claude/agents/rule-guard.md 생성
  [ ] CLAUDE.md에 Rule Guard 지침 추가
  [ ] 컨텍스트 컴팩션 훅 설정

Phase 7: Baden 연동
  [ ] Rules Path와 함께 프로젝트 등록, MCP 서버 등록 (사용자가 수행)
  [ ] CLAUDE.md에 Baden Monitoring 블록 복사, Rule Guard 섹션에 taskId 줄 추가
  [ ] SessionStart 훅 + 래퍼 생성, .claude/settings.json에서 허용
  [ ] rule-guard.md에 보고 섹션 추가
  [ ] 대시보드에서 이벤트, 규칙, Rule Guard 보고 확인
```

---

## 참고: 프로젝트 성숙도별 접근

**새 프로젝트 (코드 없음)**
- Phase 1 생략, Phase 2부터 시작
- 코드를 쓰기 전에 principles.md와 핵심 Concerns만 먼저 작성
- 코드가 쌓이면서 Specifics를 점진적으로 추가
- Phase 4~5 (감사/리팩토링) 불필요

**초기 프로젝트 (~10K lines)**
- Phase 1을 빠르게 수행
- 주요 패턴만 규칙화 (Concerns 3~5개, Specifics 2~3개)
- 가벼운 감사 후 즉시 정상 운영

**성장한 프로젝트 (~50K+ lines)**
- Phase 1을 철저히 수행
- 전체 Tier 구조 적용
- 전수 감사 + 체계적 리팩토링 필수
- Baden 연동 권장 (행동 관측 없이 준수율 유지 어려움)
