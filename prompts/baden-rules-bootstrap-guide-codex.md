# Baden Rules Bootstrap Guide for Codex

Codex 기반 프로젝트에서 규칙 기반 AI 에이전트 개발 파이프라인과 Baden 보고 체계를 구축하기 위한 표준 지침.

이 문서는 다음 전제를 기반으로 한다.

- 프로젝트 지침의 진입점은 `AGENTS.md` 이다.
- 역할 분리는 Codex custom agents로 구성한다.
- 반복 절차는 Codex skills로 패키징할 수 있다.
- 실행 권한과 네트워크 범위는 approvals / sandbox / MCP 설정으로 통제한다.
- Claude Code hooks 같은 자동 라이프사이클 훅은 전제하지 않는다.
- 따라서 보고와 검증은 **명시적 워크플로우**로 운영한다.

---

## 왜 Rules인가

AI 코딩 에이전트는 코드를 실제로 읽지 않고 추론으로 대체하며, 자기가 규칙을 따랐다고 스스로 확신한다. 문서는 코드와 괴리가 생기고 유지보수 자체가 부담이 된다. 코드가 스스로를 설명하게 하려면 일관된 품질과 구조가 필요하고, 그 일관성을 유지하는 뼈대가 규칙이다.

단, 규칙이 커버하는 영역은 명확히 구분해야 한다.

- **정적 분석 도구**  
  기계적으로 검증 가능한 것  
  예: unused imports, formatting, naming conventions, type checking

- **Rules (이 시스템)**  
  의미와 맥락이 필요한 것  
  예: 설계 패턴 준수, 도메인 로직 제약, 의존성 방향, 아키텍처 원칙

정적 분석 도구가 잡을 수 있는 것은 정적 분석에 맡긴다. 빠르고, 싸고, 100% 일관되고, 누락이 없다. Rules는 LLM만이 판단할 수 있는 영역에 집중한다.

---

## Codex 운영 원칙

1. 프로젝트 전역 지침은 `AGENTS.md`에 둔다.
2. 규칙 자체는 `rules/` 디렉터리에 둔다.
3. 구현과 검증 역할은 분리한다.
4. 수정 전 검토와 수정 후 검증을 모두 수행한다.
5. 가능하면 Baden에 계획과 행동을 보고한다.
6. hooks에 의존하지 않고, **항상 명시적으로** 검증과 보고를 호출한다.
7. approvals / sandbox 설정은 최소 권한 원칙으로 운영한다.

---

## 표준 디렉터리 구조

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
│   │   ├── C1-{이름}.md
│   │   ├── C2-{이름}.md
│   │   └── ...
│   ├── specifics/
│   │   ├── S-{도메인}.md
│   │   └── ...
│   ├── _analysis.md
│   ├── _audit-v1.md
│   └── _audit-v2.md
└── scripts/
    └── baden-report.sh
```

---

# Phase 1: 프로젝트 분석

## 1-1. 구조 파악

프로젝트의 전체 구조를 파악한다. 아래 항목을 조사해 `rules/_analysis.md`에 기록한다.

```markdown
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

## 1-2. 패턴 탐색

코드베이스에서 반복되는 패턴과 안티패턴을 탐색한다. 프로젝트의 주 언어에 맞는 도구와 검색 패턴을 사용한다.

```bash
# 디렉터리 구조 파악
find . -type f -name "*.{주 언어 확장자}" | head -100

# import / dependency 패턴
grep -r "import\|require\|include\|use\|from" --include="*.{확장자}" | head -50

# 인스턴스 생성 패턴 (싱글턴 위반 후보)
grep -rn "new \|::new\|\.create(\|getInstance\|\.build(" --include="*.{확장자}" | head -30

# 에러 처리 패턴
grep -rn "try\|catch\|except\|rescue\|throw\|raise\|panic" --include="*.{확장자}" | head -30

# public API / export 패턴
grep -rn "export\|public\|pub fn\|module\.exports\|__all__" --include="*.{확장자}" | head -30
```

관찰 결과를 `rules/_analysis.md`에 추가한다.

```markdown
### 발견된 공통 패턴
- (예: DB 클라이언트를 각 파일에서 직접 생성하고 있음)
- (예: 에러를 catch 후 로깅만 하고 재전파하지 않음)
- (예: 설정값이 여러 파일에 하드코딩되어 있음)

### 발견된 안티패턴
- (예: 핸들러/컨트롤러에 비즈니스 로직이 200줄 이상 직접 작성됨)
- (예: 동일 기능의 유틸 함수가 여러 곳에 중복 구현됨)
```

## 1-3. 정적 분석 현황 확인

프로젝트에서 사용 중인 정적 분석 도구의 설정을 확인하고, 기계적으로 커버되는 영역을 파악한다. 정적 분석으로 커버되는 항목은 Rules에 중복 작성하지 않는다.

정적 분석 도구가 아직 없다면 프로젝트 언어에 맞는 도구 도입을 권장한다. 기계적 검증은 기계에 맡기는 것이 원칙이다.

---

# Phase 2: 규칙 체계 설계

## 디렉터리 구조

```text
rules/
├── INDEX.yaml
├── principles.md
├── concerns/
│   ├── C1-{이름}.md
│   ├── C2-{이름}.md
│   └── ...
├── specifics/
│   ├── S-{도메인}.md
│   └── ...
└── _analysis.md
```

## 3 Tier 구조

### Tier 1 — Principles (`principles.md`)

모든 코드에 항상 적용되는 핵심 원칙. 6개 이하로 유지한다.

예시:

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

### Tier 2 — Concerns (`concerns/C*.md`)

횡단 관심사 규칙.

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

### Tier 3 — Specifics (`specifics/S-*.md`)

특정 도메인 또는 특정 기술에만 적용되는 규칙. 같은 형식을 따른다.

## INDEX.yaml 설계

트리거 매핑 파일. 어떤 파일을 수정할 때 어떤 규칙을 로드할지 정의한다.

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

# Phase 3: 규칙 작성

## 3-1. Principles 작성

Phase 1 분석 결과를 바탕으로 프로젝트에 맞는 핵심 원칙을 작성한다. 6개 이하로 유지한다. 기존 코드에서 이미 따르고 있는 좋은 패턴을 원칙으로 격상시킨다.

## 3-2. Concerns 작성

횡단 관심사를 식별한다. 일반적으로 다음 영역에서 나온다.

- 파일/디렉터리 구조와 네이밍
- 공유 자원 관리
- 에러 처리와 전파
- 하드코딩 금지
- 로깅과 모니터링
- 보안
- 테스트 작성 원칙

각 Concern에 대해:

1. 코드베이스에서 관련 패턴을 검색으로 조사
2. 좋은 패턴과 안티패턴 수집
3. MUST / MUST NOT 으로 명문화
4. INDEX.yaml에 트리거 조건 등록

## 3-3. Specifics 작성

도메인별 규칙을 작성한다.

1. 해당 도메인 코드를 읽고 설계 패턴 파악
2. 도메인 고유 제약사항을 MUST / MUST NOT으로 정의
3. INDEX.yaml에 paths / imports / patterns 트리거 등록

## 작성 원칙

- **MUST / MUST NOT만 검증 대상이다.** PREFER는 권장일 뿐 위반으로 판정하지 않는다.
- **정적 분석 도구가 잡을 수 있는 것은 쓰지 않는다.** 의미와 맥락이 필요한 것만 쓴다.
- **구체적으로 쓴다.** "좋은 코드를 작성하라"가 아니라 "핸들러에 50줄 이상의 비즈니스 로직을 직접 작성하지 마라"로 쓴다.
- **코드베이스의 현실을 반영한다.** 이상적인 규칙이 아니라 이 프로젝트에서 실제로 지켜야 하는 것을 쓴다.
- **규칙 수를 통제한다.** Concern 9개 이하, Specific은 핵심 도메인만.

---

# Phase 4: 초기 감사 (Audit)

규칙 작성 완료 후 현재 코드베이스를 전수 감사한다.

## 4-1. 감사 계획

```markdown
## AUDIT-v1 계획

### 목적
rules/ 규칙 기준으로 전체 코드베이스의 현재 준수율을 측정한다.

### 감사 범위
전수 감사. 모든 소스 파일을 대상으로 한다.

### 배치 분할
- Batch 1: Principles + Concerns C1~C(n)
- Batch 2: Specifics S-*
- (필요시 추가 배치)

### 세션 전략
배치당 1세션. 감사 결과는 rules/_audit-v1.md에 기록한다.
```

## 4-2. 감사 실행

각 배치에서:

1. 해당 규칙 파일을 읽는다
2. 관련 코드를 검색으로 전수 확인한다
3. MUST / MUST NOT 위반을 기록한다
4. 위반마다 severity를 판정한다  
   `Critical / High / Medium / Low`

## 4-3. 감사 결과 형식

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

## 4-4. 예외 판정

예외는 해당 규칙 파일에 `Exception` 섹션으로 명시한다.

- 프레임워크/라이브러리 요구 패턴
- 성능 이유의 의도적 설계
- 마이그레이션 비용이 가치를 초과하는 경우

---

# Phase 5: 리팩토링

감사 결과를 바탕으로 위반을 해소한다.

## 5-1. Track 분할

```markdown
Track A: 기계적 수정
Track B: 구조 수정
Track C: 도메인 수정
Track D: 최종 감사 (AUDIT-v2)
```

## 5-2. 실행 원칙

- Critical → High → Medium → Low 순서
- Track별로 독립 세션에서 진행
- 각 Track 완료 후 빌드/테스트 통과 확인
- Rule Guard 사전/사후 검증 수행

## 5-3. 최종 감사

리팩토링 완료 후 AUDIT-v2를 실행해 준수율을 재측정한다. 목표는 `Critical 0, High 0` 이다.

---

# Phase 6: Rule Guard 설정

Codex에서는 Rule Guard를 custom agent로 정의한다.

## `.codex/agents/rule-guard.toml`

```toml
name = "rule-guard"
description = "코드 수정 전과 후에 호출한다. rules/ 디렉터리의 규칙을 기준으로 수정 계획 또는 수정 결과가 MUST/MUST NOT 항목을 위반하지 않는지 검증한다."

developer_instructions = """
# Rule Guard

코드 수정의 규칙 준수 여부를 검증하는 서브에이전트.
코드를 수정하지 않는다. 읽기, 검색, 보고만 수행한다.

## 호출 시점

1. 사전 검토: 수정 계획 수립 후, 실행 전에 호출한다
2. 사후 검증: 수정 완료 후, 실제 코드가 규칙을 준수하는지 호출한다

## 검증 절차

### 사전 검토
1. 수정 대상 파일 목록을 확인한다
2. rules/INDEX.yaml에서 각 파일에 적용되는 규칙을 확인한다
3. 해당 규칙 파일을 읽는다
4. 수정 계획이 MUST / MUST NOT 항목을 위반하지 않는지 확인한다
5. PASS 또는 ISSUE를 반환한다

### 사후 검증
1. 수정된 파일을 읽는다
2. 규칙 기준으로 실제 코드를 검증한다
3. grep 등으로 위반 패턴이 잔존하지 않는지 확인한다
4. PASS 또는 ISSUE를 반환한다

## 원칙
- MUST / MUST NOT 위반만 판정한다. PREFER는 판정하지 않는다.
- 규칙 파일을 추론하지 않는다. 반드시 읽고 판정한다
- 규칙 파일을 수정하지 않는다
- 코드를 수정하지 않는다. 파일 쓰기를 수행하지 않는다.
- Bash는 보고와 grep 검색에만 사용한다.
- 규칙에 명시되지 않은 사항은 위반으로 판정하지 않는다
"""
```

## 선택적 보조 에이전트

### `.codex/agents/auditor.toml`

```toml
name = "auditor"
description = "rules/ 기준으로 코드베이스를 배치 단위로 전수 감사한다."

developer_instructions = """
rules/와 INDEX.yaml을 읽고, 지정된 범위의 파일을 감사하라.
코드를 수정하지 말고 위반 목록과 severity만 보고하라.
"""
```

### `.codex/agents/refactorer.toml`

```toml
name = "refactorer"
description = "지정된 위반을 해소하도록 최소 범위로 코드를 수정한다."

developer_instructions = """
규칙을 먼저 읽고, 지정된 위반만 해소하라.
변경 범위를 최소화하라.
수정 전 사전 검토 결과를 확인하고, 수정 후 사후 검증이 가능하도록 변경 이유를 명확히 남겨라.
"""
```

---

# Phase 7: AGENTS.md 설정

`AGENTS.md`는 Codex의 프로젝트 진입점이다.

## 루트 `AGENTS.md` 예시

```markdown
# Project Agent Instructions

## Core Rule System
- 이 프로젝트의 구현 규칙은 `rules/` 디렉터리에 정의되어 있다.
- 작업 시작 시 `rules/INDEX.yaml`을 먼저 확인한다.
- 현재 작업에 적용되는 규칙 파일을 읽고 진행한다.
- MUST / MUST NOT 위반은 금지한다.
- 규칙 파일을 추론하지 않는다. 반드시 읽고 판정한다.
- 규칙 파일을 수정하지 않는다. 사용자가 명시적으로 요청한 경우만 예외다.

## Rule Guard Workflow
- 코드 수정 전에는 `rule-guard`로 사전 검토를 수행한다.
- 코드 수정 후에는 `rule-guard`로 사후 검증을 수행한다.
- 사전 검토가 ISSUE이면 수정 계획부터 고친다.
- 사후 검증이 ISSUE이면 작업 완료로 간주하지 않는다.

## Build and Test
- task complete 보고 전에 관련 빌드/테스트를 통과해야 한다.
- 테스트가 없으면 최소한 정적 분석 또는 관련 검증 명령을 수행한다.

## Change Discipline
- 수정 범위는 최소화한다.
- 현재 작업과 무관한 리팩토링을 섞지 않는다.
- 구조 변경은 변경 이유를 설명 가능해야 한다.

## Baden Monitoring
- 이 프로젝트는 Baden 모니터링 하에서 운영된다.
- 사용자 지시를 받으면 작업 시작 전에 Baden에 시작 보고를 한다.
- 접근 방식을 정하면 Baden에 계획 보고를 한다.
- 코드 수정 시작 전, 검증 시작 전, 작업 종료 시 Baden에 보고한다.
- 보고가 누락되면 즉시 보완하고 이후 단계를 진행한다.

## Operational Constraint
- hooks가 있다고 가정하지 않는다.
- 검증과 보고는 항상 명시적으로 수행한다.
```

---

# Phase 8: Baden 연동

Codex에서는 Baden 연동을 다음 세 가지 방식 중 하나로 운영한다.

## 권장 우선순위

1. **MCP 서버 방식**
2. **프로젝트 스크립트 방식**
3. **직접 HTTP 호출 방식**

자동 훅을 전제하지 않으므로, 보고는 명시적 워크플로우 단계로 수행한다.

## 8-1. 프로젝트 등록

Baden 대시보드 또는 API로 프로젝트를 등록한다.

## 8-2. 보고 이벤트 모델

최소한 다음 이벤트를 사용한다.

- `baden_start_task`
- `baden_plan`
- `baden_action`
- `baden_rule`
- `baden_verify`
- `baden_complete_task`

## 8-3. 보고 시점

### 사용자 지시 수신
작업 시작 전에 `baden_start_task`. 반환된 taskId를 이후 같은 작업의 모든 보고에 사용한다.

### 계획 수립
접근 방식을 정하면 `baden_plan`. 코드를 읽거나 수정하지 않더라도 계획 단계에서 호출한다.

### 행동 보고
`baden_action`을 모든 행동 **실행 전에** 호출한다. 규칙 관련 행동에는 `baden_rule`, 검증 행동에는 `baden_verify`를 사용한다.

### 완료 시
작업 종료 후 `baden_complete_task`

## 8-4. 원칙

- **보고 없이 행동하지 않는다.** 모든 읽기, 검색, 테스트는 보고 후 수행한다.
- **계획도 보고한다.** 도구 호출이 아닌 사고 과정도 보고 대상이다.
- **행동을 자유롭게 기술한다.** snake_case 키워드를 직접 만들어 행동을 요약한다.
- **이유를 구체적으로 쓴다.** 나중에 읽었을 때 맥락이 이해되는 수준으로 쓴다.
- Codex 환경에서는 플랫폼 훅을 가정하지 않으므로, **단계 단위 보고를 강제 운영 규칙**으로 둔다.
- 최소한 **시작 / 계획 / 수정 시작 / 검증 / 완료** 다섯 단계는 필수 보고로 운영한다.
- 세부 행동 보고가 필요하면 wrapper script 또는 MCP 도구에서 일괄 처리한다.

## 8-5. INDEX.yaml 연동

Baden은 프로젝트의 `rules/INDEX.yaml`을 파싱해 규칙 메타데이터를 등록한다. 규칙별 참조/위반/수정 빈도가 대시보드에서 추적된다.

---

# Phase 9: Baden 스크립트 방식

MCP 대신 스크립트로 보고할 수 있다.

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

## 사용 예시

```bash
scripts/baden-report.sh baden_start_task "사용자 요청 수신: 규칙 시스템 초기화"
scripts/baden-report.sh baden_plan "rules 구조를 먼저 분석하고 INDEX.yaml 초안을 작성"
scripts/baden-report.sh baden_action "C2 위반 해소를 위해 서비스 레이어 분리 시작" "task-123"
scripts/baden-report.sh baden_verify "리팩토링 후 테스트와 rule-guard 검증 수행" "task-123"
scripts/baden-report.sh baden_complete_task "Track B 완료" "task-123"
```

---

# Phase 10: Skills 설정

반복 절차는 Codex skill로 패키징할 수 있다.

## `.codex/skills/rules-audit/SKILL.md`

```markdown
---
name: rules-audit
description: rules/INDEX.yaml과 규칙 파일을 기준으로 코드베이스를 감사하는 절차
---

# Rules Audit Skill

## 목적
규칙 파일과 코드베이스를 대조해 MUST / MUST NOT 위반을 찾는다.

## 절차
1. rules/INDEX.yaml을 읽는다
2. 적용 대상 규칙 파일을 읽는다
3. 지정 범위의 코드를 검색한다
4. 위반을 severity와 함께 정리한다
5. 결과를 `rules/_audit-*.md` 형식으로 제안한다

## 제약
- 코드를 수정하지 않는다
- PREFER는 위반으로 판정하지 않는다
- 규칙 파일을 추론하지 않는다
```

## `.codex/skills/baden-report/SKILL.md`

```markdown
---
name: baden-report
description: Baden 보고 절차를 일관되게 수행하는 운영 스킬
---

# Baden Report Skill

## 목적
작업의 주요 단계에서 Baden 보고를 누락하지 않도록 한다.

## 필수 단계
1. start_task
2. plan
3. action
4. verify
5. complete_task

## 원칙
- hooks를 가정하지 않는다
- 명시적으로 보고한다
- taskId를 일관되게 재사용한다
```

---

# Phase 11: Codex 설정

## `.codex/config.toml` 예시

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

## 운영 가이드

- 기본값은 `workspace-write` 또는 그에 준하는 최소 권한으로 운영한다.
- 감사와 규칙 검증은 가능한 한 읽기 전용 프로필을 사용한다.
- 네트워크가 꼭 필요하지 않으면 끈다.
- Baden이 MCP 또는 HTTP를 통해 필요하면 최소 범위로만 허용한다.
- 완전 무제한 모드는 외부에서 충분히 격리된 환경에서만 사용한다.

---

# Phase 12: 표준 실행 시나리오

## 시나리오 A — 새 기능 구현

1. Baden 시작 보고
2. `rules/INDEX.yaml` 확인
3. 적용 규칙 파일 읽기
4. `rule-guard` 사전 검토
5. 구현
6. Baden 검증 보고
7. 테스트 / 정적 분석
8. `rule-guard` 사후 검증
9. Baden 완료 보고

## 시나리오 B — 감사 실행

1. Baden 시작 보고
2. 감사 범위 정의
3. `auditor` 실행
4. 위반 목록 작성
5. Baden 완료 보고

## 시나리오 C — 리팩토링 Track 수행

1. Baden 시작 보고
2. 대상 위반 선정
3. `rule-guard` 사전 검토
4. `refactorer` 수정
5. 테스트 / 검증
6. `rule-guard` 사후 검증
7. Baden 완료 보고

---

# 체크리스트

```text
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
  [ ] Critical / High 해소
  [ ] AUDIT-v2 실행
  [ ] Critical 0, High 0 달성

Phase 6: Rule Guard
  [ ] .codex/agents/rule-guard.toml 생성
  [ ] AGENTS.md에 Rule Guard 지침 추가

Phase 7: Baden 연동
  [ ] 프로젝트 등록
  [ ] AGENTS.md에 Baden 보고 지침 추가
  [ ] MCP 또는 스크립트 보고 설정
  [ ] INDEX.yaml 연동 확인

Phase 8: Skills
  [ ] rules-audit skill 작성
  [ ] baden-report skill 작성

Phase 9: Codex 설정
  [ ] .codex/config.toml 작성
  [ ] 프로필 분리
  [ ] sandbox / approval 정책 검토
```

---

# 참고: 프로젝트 성숙도별 접근

## 새 프로젝트 (코드 없음)

- Phase 1 생략 가능
- Phase 2부터 시작
- 코드를 쓰기 전에 principles.md와 핵심 Concerns만 먼저 작성
- 코드가 쌓이면서 Specifics를 점진적으로 추가
- 초기에는 감사/리팩토링 불필요

## 초기 프로젝트 (~10K lines)

- Phase 1을 빠르게 수행
- 주요 패턴만 규칙화
- Concerns 3~5개, Specifics 2~3개
- 가벼운 감사 후 즉시 정상 운영

## 성장한 프로젝트 (~50K+ lines)

- Phase 1을 철저히 수행
- 전체 Tier 구조 적용
- 전수 감사 + 체계적 리팩토링 필수
- Baden 연동 권장
- 가능하면 감사 전용 프로필과 구현 전용 프로필을 분리 운영

---

# 최종 운영 원칙 요약

- `AGENTS.md`는 프로젝트의 Codex 진입 규칙이다.
- `rules/`는 실제 구현 규칙의 소스 오브 트루스다.
- `rule-guard`는 항상 수정 전후에 호출한다.
- hooks를 전제하지 않는다.
- Baden 보고는 명시적으로 수행한다.
- approvals / sandbox는 최소 권한 원칙으로 운영한다.
- 반복 절차는 skills로 패키징한다.
- 감사와 구현 역할은 분리한다.
