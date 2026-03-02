# Baden

AI 코딩 에이전트의 행동을 실시간으로 모니터링하는 로컬 도구.

에이전트가 파일을 읽고, 코드를 수정하고, 테스트를 돌리는 모든 과정을 이벤트로 수집하여
타임라인, 규칙 히트맵, 요약 대시보드로 시각화한다.

## 핵심 컨셉

**자유 서술 → 사후 분류** — 에이전트는 고정된 이벤트 타입을 외울 필요 없이, 자신의 행동을 자유로운 snake_case 키워드로 보고한다. 서버가 첫 단어 기반 패턴 매칭으로 내부 이벤트 타입(`file_read`, `code_modify` 등)으로 자동 분류한다.

**보고 → 확인 → 실행** — 에이전트는 모든 행동을 실행 전에 Baden에 보고한다. 파일 읽기, 검색, 코드 수정, 테스트 실행 등 예외 없이 사전 보고 원칙을 따른다.

## 아키텍처

```
AI 에이전트 (Claude Code, ...)
    │
    │  MCP 도구 호출 (stdio)
    ▼
Baden MCP Server ──HTTP POST──▶ /api/query ─── inferEventType() ─── SQLite
                                                     │
                                                WebSocket broadcast
                                                     │
                                                     ▼
                                              React 대시보드
                                          (타임라인 · 히트맵 · 로그)
```

## Quick Start

### 1. 설치 및 빌드

```bash
git clone <repository-url> baden
cd baden
npm run build
```

이 명령은 `client`, `server`, `mcp` 세 모듈을 모두 빌드한다.

### 2. 서버 실행

```bash
# 데몬으로 실행 (백그라운드)
node bin/baden.js start

# 포트 지정
node bin/baden.js start -p 4000

# 포그라운드 실행 (디버깅용)
node bin/baden.js run
```

서버가 시작되면:
- **대시보드**: http://localhost:3800
- **API**: http://localhost:3800/api
- **WebSocket**: ws://localhost:3800/ws
- **DB**: `~/.baden/baden.db` (자동 생성)
- **로그**: `~/.baden/logs/` (날짜별 로테이션)

### 3. CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `baden start [-p port]` | 데몬 시작 (기본 포트 3800) |
| `baden stop` | 데몬 중지 |
| `baden status` | 실행 상태 확인 |
| `baden logs` | 최신 로그 tail |
| `baden run [-p port]` | 포그라운드 실행 |

### 4. 개발 모드

```bash
# 서버 (hot reload)
npm run dev:server    # http://localhost:3800

# 클라이언트 (Vite dev server)
npm run dev:client    # http://localhost:3801
```

---

## 프로젝트 연동

Baden으로 AI 에이전트를 모니터링하려면 두 가지 설정이 필요하다:
1. **MCP 서버 등록** — 에이전트가 Baden 도구를 사용할 수 있게
2. **CLAUDE.md 지침** — 에이전트가 매 행동마다 보고하도록 강제

### Step 1: MCP 서버 빌드

```bash
cd baden
npm run build:mcp
```

빌드 결과물: `mcp/dist/index.js`

### Step 2: MCP 서버 등록

Claude Code의 MCP 설정에 Baden을 추가한다. 두 가지 방법 중 선택:

#### 방법 A: 글로벌 등록 (`~/.claude.json`)

모든 프로젝트에서 Baden 도구를 사용할 수 있게 된다.

`~/.claude.json`의 `mcpServers` 섹션에 추가:

```json
{
  "mcpServers": {
    "baden": {
      "command": "node",
      "args": ["/absolute/path/to/baden/mcp/dist/index.js"],
      "env": {
        "BADEN_API_URL": "http://localhost:3800"
      }
    }
  }
}
```

#### 방법 B: 프로젝트별 등록 (`.mcp.json`)

특정 프로젝트에서만 사용하려면, 모니터링할 프로젝트 루트에 `.mcp.json` 생성:

```json
{
  "mcpServers": {
    "baden": {
      "command": "node",
      "args": ["/absolute/path/to/baden/mcp/dist/index.js"],
      "env": {
        "BADEN_API_URL": "http://localhost:3800"
      }
    }
  }
}
```

> `args`의 경로는 반드시 **절대 경로**로 지정한다.

### Step 3: CLAUDE.md에 모니터링 지침 추가

MCP 도구가 연결되어도 에이전트가 자동으로 매번 호출하지는 않는다.
모니터링할 프로젝트의 `CLAUDE.md`에 아래 지침을 추가하여 보고를 강제한다:

```markdown
## Baden Monitoring
- Project Name: `my-project`

이 프로젝트는 Baden 모니터링 하에 운영된다. 모든 행동에 대해 해당하는 baden MCP 도구를 호출하라.

### 사용자 지시 수신
사용자가 새로운 지시를 내리면, **작업을 시작하기 전에** `baden_start_task`를 호출하라.
이후 같은 작업의 모든 도구 호출에 반환된 `taskId`를 사용하라.

### 계획 수립 보고
코드를 읽거나 수정하지 않더라도, **접근 방식을 결정하거나 계획을 세울 때** `baden_plan`을 호출하라.
계획 모드(plan mode)에 진입했을 때도 동일하게 보고한다.

### 행동 보고
이후 모든 행동을 실행하기 **전에** `baden_action`을 호출하라.
규칙 관련 행동은 `baden_rule`, 검증 행동은 `baden_verify`를 사용한다.

### 작업 완료 보고
작업이 완료되면 `baden_complete_task`를 호출하라.

### 원칙
- **보고 없이 행동하지 마라.** 파일 읽기, 검색, 테스트 실행 등 모든 행동은 Baden에 보고한 뒤 수행한다.
- **계획 수립도 보고하라.** 접근 방식 결정, 계획 작성 등 도구를 사용하지 않는 사고 과정도 보고 대상이다.
- **action은 자유롭게 서술하라.** 수행할 행동을 요약하는 snake_case 키워드를 직접 만들어 사용하라.
- **reason은 구체적으로 기술하라.** 나중에 읽어도 맥락을 이해할 수 있는 설명을 작성하라.
```

> `Project Name`은 Baden 대시보드에서 프로젝트를 생성할 때 사용한 이름과 **정확히 일치**해야 한다.

### Step 4: 프로젝트 등록

Baden 대시보드(http://localhost:3800)에서 사이드바의 `+` 버튼으로 프로젝트를 생성한다.

또는 API로 직접 등록:

```bash
curl -X POST http://localhost:3800/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"my-project","description":"프로젝트 설명"}'
```

> `name`은 CLAUDE.md의 `Project Name`과 동일해야 한다. 에이전트가 보고할 때 이 이름으로 프로젝트를 찾는다.

### 연동 확인

설정이 완료되면 Claude Code에서 아무 작업을 지시해보자. 에이전트가 `baden_start_task`를 호출하고,
이후 `baden_action`, `baden_plan` 등을 호출하면서 대시보드에 실시간으로 이벤트가 표시된다.

---

## 서브에이전트 연동

Claude Code의 서브에이전트(Agent tool로 실행되는 에이전트)는 **MCP 도구에 접근할 수 없다**.
서브에이전트가 Baden에 보고하려면 HTTP 직접 호출 방식을 사용해야 한다.

### 접근 방식: Session Start Hook + curl 래퍼

#### 1. Hook 스크립트 생성

모니터링할 프로젝트에 `.claude/hooks/setup-baden.sh` 생성:

```bash
#!/bin/bash
cat > /tmp/baden-my-project << 'SCRIPT'
#!/bin/bash
curl -s -X POST http://localhost:3800/api/query \
  -H 'Content-Type: application/json' \
  -d "{\"projectName\":\"my-project\",$1}"
SCRIPT
chmod +x /tmp/baden-my-project
```

> `my-project`를 실제 프로젝트 이름으로 변경한다.

#### 2. Hook 등록

`.claude/settings.local.json`에 SessionStart hook으로 등록:

```json
{
  "permissions": {
    "allow": [
      "Bash(/tmp/baden-my-project:*)"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/setup-baden.sh"
          }
        ]
      }
    ]
  }
}
```

`permissions.allow`에 `/tmp/baden-my-project` 실행 권한을 추가해야 서브에이전트가 자동으로 호출할 수 있다.

#### 3. 서브에이전트 정의에서 사용

서브에이전트 정의 파일(`.claude/agents/my-agent.md`)에서 다음과 같이 사용:

```markdown
---
name: my-agent
tools: Read, Glob, Grep, Bash
---

## Baden 보고

모든 행동을 `/tmp/baden-my-project`를 통해 Baden에 보고한다.
**MCP 도구(`baden_*`)는 서브에이전트에서 사용할 수 없다. 반드시 Bash로 `/tmp/baden-my-project`를 호출한다.**

### 보고 형식

```bash
/tmp/baden-my-project '"action":"check_files","target":"src/index.ts","reason":"대상 파일 확인","taskId":"..."'
```
```

#### 4. taskId 전달

메인 에이전트가 서브에이전트를 호출할 때, 현재 `taskId`를 프롬프트에 포함해야 한다:

```
CLAUDE.md에 다음과 같이 명시:

→ rule-guard 호출 (사전 검토, **반드시 현재 taskId를 프롬프트에 포함**)
```

이렇게 하면 서브에이전트의 보고가 메인 에이전트의 태스크와 연결된다.

---

## MCP 도구 레퍼런스

| 도구 | 시점 | 주요 파라미터 |
|------|------|--------------|
| `baden_start_task` | 사용자 지시 수신 시 | `prompt`, `projectName` → `taskId` 반환 |
| `baden_plan` | 계획/설계 시 | `taskId`, `action`, `reason` |
| `baden_action` | 행동 실행 전 | `taskId`, `action`, `target?`, `reason?` |
| `baden_verify` | 검증 완료 후 | `taskId`, `action`, `result`, `target?` |
| `baden_rule` | 규칙 관련 활동 | `taskId`, `action`, `ruleId`, `severity?`, `target?`, `reason?` |
| `baden_complete_task` | 작업 완료 시 | `taskId`, `summary` |

### action 작성 규칙

`action`은 snake_case로 자유롭게 작성한다. **첫 단어**가 이벤트 분류를 결정한다:

| 첫 단어 | 분류 | 예시 |
|---------|------|------|
| `read`, `search`, `scan`, `find` | 탐색 | `read_auth_logic`, `search_usage` |
| `plan`, `analyze`, `review`, `decide` | 계획 | `plan_refactor`, `analyze_requirements` |
| `create`, `modify`, `write`, `fix`, `add` | 구현 | `modify_handler`, `create_migration` |
| `test`, `build`, `lint`, `typecheck` | 검증 | `test_auth_flow`, `build_project` |
| `rule`, `violation`, `check` | 규칙 | `check_c5_compliance`, `violation_found` |

> `run_`은 skip word — `run_test`는 `test`로 분류된다.

---

## API

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/projects` | 프로젝트 등록 |
| `GET` | `/api/projects` | 프로젝트 목록 |
| `GET` | `/api/projects/:id` | 프로젝트 상세 |
| `PUT` | `/api/projects/:id` | 프로젝트 수정 |
| `GET` | `/api/projects/:id/rules` | 규칙 목록 |
| `PUT` | `/api/projects/:id/sync` | 규칙 디렉토리 재스캔 |
| `POST` | `/api/query` | 에이전트 행동 보고 (자유 서술) |
| `POST` | `/api/events` | 이벤트 직접 수신 (단건/배치) |
| `GET` | `/api/events` | 이벤트 조회 (projectId, type, date 필터) |
| `GET` | `/api/events/dates` | 이벤트가 존재하는 날짜 목록 |
| `GET` | `/api/projects/:id/action-registry` | 액션 패턴 목록 |
| `POST` | `/api/projects/:id/action-registry` | 액션 패턴 생성 |
| `GET` | `/api/projects/:id/action-registry/prefixes` | 액션 접두사 목록 |
| `POST` | `/api/projects/:id/action-registry/prefixes` | 액션 접두사 생성 |
| `WS` | `/ws?projectId=<id>` | 실시간 이벤트 스트리밍 |

---

## 이벤트 카테고리

| 카테고리 | 이벤트 타입 | 설명 |
|----------|------------|------|
| 탐색 | `code_search`, `file_read`, `doc_read`, `dependency_check` | 코드베이스를 읽거나 검색 |
| 계획 | `task_analysis`, `approach_decision`, `task_complete` | 요구사항 분석, 방식 결정, 작업 완료 |
| 구현 | `code_create`, `code_modify`, `refactor`, `file_write` | 코드 작성 및 수정 |
| 검증 | `test_run`, `build_run`, `lint_run` | 테스트, 빌드, 린트 실행 |
| 규칙 | `rule_match`, `violation_found`, `fix_applied` | 규칙 참조, 위반 발견, 수정 |

---

## 주요 기능

### 타임라인 시각화
- 카테고리별 **레인(lane)** 분리 — User, 탐색, 계획, 구현, 규칙 준수
- **Gap 압축** — 3분 이상 유휴 구간을 접어 밀도 높은 뷰 제공
- **긴 이벤트 압축** — 뷰포트를 초과하는 단일 이벤트 처리
- **3단계 확장 토글** — 축소 / 확장 / 상세
- **미니맵** — 전체 타임라인 오버뷰 + 네비게이션
- **마우스 드래그 패닝** — 관성 스크롤 지원
- **태스크 체인 연결선** — L자형 라우팅 + 화살표

### 액션 레지스트리
- **접두사/키워드 2단계 분류** — `read_`, `create_` 등 접두사로 광역 분류 후 키워드 매칭으로 세부 오버라이드
- 발견된 액션 패턴을 카테고리, 라벨, 아이콘으로 정의
- 패턴 테스트 및 일괄 확인

### 규칙 히트맵
- `rules/` 디렉토리의 코딩 규칙을 파싱하여 등록
- 규칙별 참조/위반/수정 빈도를 히트맵으로 표시
- 규칙 본문 마크다운 렌더링

### 이벤트 드로어
- 고정(pin) 가능한 사이드바
- 이벤트 상세 정보 + 관련 규칙 표시
- 리사이즈 가능

---

## 기술 스택

- **Server**: Node.js + Express + TypeScript + WebSocket(ws) + SQLite(better-sqlite3)
- **Client**: React 19 + Vite + Tailwind CSS v4 + Recharts + Radix UI + Phosphor Icons
- **MCP**: @modelcontextprotocol/sdk (stdio transport)
- **Ports**: Server `3800`, Client dev `3801`
