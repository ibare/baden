[English](./README.md) | **한국어**

# Baden

AI 코딩 에이전트가 지금 무엇을 하고 있는지 실시간으로 지켜보는 로컬 도구다.

에이전트가 밟는 모든 단계 — 파일 읽기, 계획 세우기, 코드 수정, 테스트 실행, 프로젝트 규칙 확인 — 가
이벤트로 모이고, 실시간 타임라인, 규칙 분석, 여러 프로젝트를 아우르는 대시보드로 보여진다.

MCP 를 통해 **Claude Code** 와 **OpenAI Codex** 에서 동작한다.

## 핵심 아이디어

**보고는 자유롭게, 분류는 서버가** — 에이전트는 정해진 이벤트 타입 목록을 외우지 않는다.
각 행동을 스스로 만든 snake_case 키워드(`read_auth_logic`, `modify_handler`)로 설명하고,
서버가 이를 내부 이벤트 타입(`file_read`, `code_modify`, ...)으로 짝지어 준다.

**먼저 보고하고, 그다음 행동한다** — 에이전트는 모든 행동을 하기 *전에* Baden 에 보고한다.
읽기, 검색, 수정, 테스트 실행 모두 마찬가지다.

**규칙이 뼈대다** — 프로젝트의 `rules/` 디렉터리를 Baden 에 알려 주면 각 규칙이 얼마나 자주
확인되고, 어겨지고, 고쳐지는지를 추적한다. 그래서 어떤 규칙이 실제로 효과가 있는지 볼 수 있다.

## 아키텍처

```
AI agent (Claude Code, Codex)
    │
    │  MCP tool calls (stdio)
    ▼
Baden MCP server ──HTTP POST──▶ /api/query ── classify action ── SQLite
                                                   │
                                           WebSocket broadcast
                                                   │
                                                   ▼
                                           React dashboard
                                (timeline · analysis · comparison)
```

서버 프로세스 하나(포트 `3800`)가 API, WebSocket, 빌드된 대시보드를 모두 제공한다.

## 요구 사항

- **Node.js** 20.19 이상 또는 22.12 이상 (Vite 7 의 요구 사항)
- 상시 서비스를 쓰려면 **macOS** (`baden install` 은 launchd 를 사용한다).
  Linux 에서는 서비스 없이 `baden start` 와 `baden run` 으로 Baden 을 실행할 수 있지만, 이 경로는
  꾸준히 테스트되지 않는다. Windows 는 지원하지 않는다.

## 빠르게 시작하기

### 1. 설치와 빌드

```bash
git clone https://github.com/ibare/baden.git
cd baden
npm run build     # builds client, server, and mcp
npm link          # puts the `baden` command on your PATH
```

`npm link` 를 하지 않았다면 `baden` 대신 `node bin/baden.js` 를 실행한다.

### 2. 서비스로 실행 (권장)

```bash
baden install
```

이 명령은 `~/Library/LaunchAgents/com.baden.server.plist` 를 만들고 launchd 에 등록한다.

- **로그인할 때 자동으로 시작된다** — 터미널을 계속 열어 둘 필요가 없다
- **비정상 종료 시 다시 시작된다** — 비정상적으로 끝나면 launchd 가 되살린다
- **프로세스 하나로 충분하다** — 서버가 대시보드까지 제공하므로 포트 `3800` 하나만 있으면 된다

MCP 서버는 모든 보고를 `http://localhost:3800` 으로 보낸다. Baden 이 실행 중이 아니면 보고는
버려진다(에이전트 자체는 절대 막히지 않는다). 그러므로 서비스로 계속 띄워 두는 것이 데이터를
잃지 않는 가장 쉬운 방법이다.

### 3. 대시보드 열기

http://localhost:3800

데이터는 `~/.baden/` 에 저장된다 — 데이터베이스는 `~/.baden/baden.db`, 로그는 `~/.baden/logs/` 에 있다.

---

## 프로젝트 연결

세 단계로 이루어진다. Baden 에 **프로젝트를 등록**하고, 에이전트에 **MCP 서버를 등록**하고,
`CLAUDE.md`(Codex 는 `AGENTS.md`)로 **에이전트에게 보고하라고 알려 준다**.

> 프로젝트를 먼저 등록한다. Baden 이 모르는 프로젝트 이름으로 들어온 보고는 버려진다.

### 1단계: 프로젝트 등록

대시보드 사이드바에서 **+** (Add Project) 를 누르고 다음을 채운다.

| 항목 | 설명 |
|---|---|
| **Name** (필수) | `CLAUDE.md` 에 적은 `Project Name` 과 정확히 같아야 한다 (대소문자 구분) |
| Description | 선택 |
| Rules Path | 프로젝트의 `rules/` 디렉터리(`INDEX.yaml` 이 들어 있는 곳)의 절대 경로. 선택 — [규칙](#규칙) 참고 |
| AI Agent | `Claude Code` 또는 `Codex` |

API 를 써도 된다.

```bash
curl -X POST http://localhost:3800/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "description": "My project",
    "rulesPath": "/absolute/path/to/my-project/rules",
    "agent": "claude_code"
  }'
```

`agent` 는 `claude_code`(기본값) 또는 `codex` 다.

> 프로젝트 이름은 겹칠 수 없다. 이미 있는 이름으로 프로젝트를 만들면 실패한다.

### 2단계: MCP 서버 등록

`npm run build` 가 이미 `mcp/dist/index.js` 로 빌드해 두었다. (MCP 서버만 다시 빌드하려면 `npm run build:mcp`.)
경로는 언제나 **절대 경로**를 쓴다.

**Claude Code — 모든 프로젝트** (`~/.claude.json` 의 `mcpServers` 아래):

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

**Claude Code — 프로젝트 하나**: 같은 JSON 을 해당 프로젝트 루트의 `.mcp.json` 에 넣는다.

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.baden]
command = "node"
args = ["/absolute/path/to/baden/mcp/dist/index.js"]
env = { BADEN_API_URL = "http://localhost:3800" }
```

서비스를 다른 포트로 설치했다면(`baden install -p 4000`) `BADEN_API_URL` 도 그에 맞게 바꾼다.

### 3단계: 모니터링 지침 추가

MCP 서버를 연결했다고 해서 에이전트가 모든 단계마다 이를 호출하지는 않는다. 모니터링할 프로젝트의
`CLAUDE.md`(Claude Code) 또는 `AGENTS.md`(Codex)에 다음 블록을 추가한다.

```markdown
## Baden Monitoring

- Project Name: `my-project`
- 이 프로젝트는 Baden 모니터링 하에서 운영된다. 모든 행동에 대해 해당 baden MCP 도구를 호출한다.

### 사용자 지시 수신
- 사용자가 새 지시를 내리면 `baden_start_task`를 호출한다. **작업 시작 전에 호출할 것.**
- 반환된 taskId를 이후 같은 작업의 모든 보고에 사용한다.

### 계획 보고
- 코드를 읽거나 수정하지 않더라도, 접근 방식을 정하거나 계획을 세울 때 `baden_plan`을 호출한다.
- 계획 모드(plan mode)에 들어갈 때도 마찬가지다.

### 행동 보고
- `baden_action`을 모든 행동 **실행 전에** 호출한다.
- 규칙 관련 행동에는 `baden_rule`, 검증 행동에는 `baden_verify`를 사용한다.

### 작업 완료 보고
- 작업이 완료되면 `baden_complete_task`를 호출한다.

### 원칙
- **보고 없이 행동하지 않는다.** 모든 읽기, 검색, 테스트는 보고 후 수행한다.
- **계획도 보고한다.** 도구 호출이 아닌 사고 과정도 보고 대상이다.
- **행동을 자유롭게 기술한다.** snake_case 키워드를 직접 만들어 행동을 요약한다.
- **이유를 구체적으로 쓴다.** 나중에 읽었을 때 맥락이 이해되는 수준으로 쓴다.
```

### 확인

에이전트에게 아무 작업이나 맡긴다. 에이전트가 `baden_start_task` 를 호출하고 이어서 `baden_plan`,
`baden_action` 등을 호출하면, 해당 프로젝트의 **Monitor** 페이지에 이벤트가 실시간으로 나타나야 한다.

아무것도 나타나지 않으면 `baden status`, 프로젝트 이름이 정확히 일치하는지, 그리고 서버 로그
(`baden logs`)를 확인한다 — 알 수 없는 프로젝트 이름은 서버 로그에 남는다.

---

## 규칙

Baden 은 프로젝트에 코딩 규칙을 적어 둔 `rules/` 디렉터리가 있을 때 가장 쓸모 있다.
프로젝트에 **Rules Path** 가 설정되어 있으면 Baden 은 이를 해석하고, `baden_rule` 보고를 개별 규칙에
연결하고, 규칙별 분석을 만든다.

### 부트스트랩 가이드로 규칙 세우기

규칙 체계를 손으로 직접 쓸 필요는 없다. 아래 프롬프트들은 기존 프로젝트나 새 프로젝트에서 에이전트가
규칙 체계를 만들어 가도록 이끈다 — 쓰는 에이전트에 맞는 것을 세션에 복사해 넣고 따라가면 된다.

| 가이드 | 용도 |
|---|---|
| [규칙 부트스트랩 가이드 — Claude Code](./prompts/baden-rules-bootstrap-guide-claude.ko.md) | 코드베이스를 분석하고, 3단 규칙 체계(원칙 / 관심사 / 세부 사항)를 설계하고, 규칙과 `INDEX.yaml` 을 쓰고, 첫 점검을 돌리고, Rule Guard 서브에이전트와 `CLAUDE.md` 를 갖추고, Baden 을 연결한다 |
| [규칙 부트스트랩 가이드 — Codex](./prompts/baden-rules-bootstrap-guide-codex.ko.md) | 같은 과정을 Codex 용으로: `AGENTS.md`, `.codex/agents/*.toml`, 스킬, `config.toml` |
| [규칙 개정 프롬프트](./prompts/rules-revision-prompt.ko.md) | *이미 있는* 규칙 체계를 서비스 성격에 따라 등급을 매긴 업계 기준에 비추어 점검하고 고친다. 보안과 개인정보에는 더 엄격한 기준을 적용한다 |

각 가이드는 영문판(`*.md`)도 있다.

### 규칙 파일 형식

Baden 은 `rules/INDEX.yaml` 을 읽는다. 이 파일은 규칙을 세 구역으로 나눠 나열한다 — `always`,
`concerns`(`C1` 같은 ID), `specifics`(`S-timeline` 같은 ID). 각 항목에는 `id`, `file`,
`description`, `triggers`(`paths`, `patterns`, `imports`, `events`)가 있다.

Baden 은 각 규칙 파일에서 이름이 정확히 다음과 같은 제목 아래의 글머리 항목을 센다.

```markdown
## MUST
## MUST NOT
## PREFER
```

파일의 나머지 부분을 다른 언어로 쓰더라도 이 제목들은 영문 그대로, `##` 단계로 둔다.

### 동기화

- 규칙은 Rules Path 를 설정할 때 동기화되고, **Analysis → Rules** 표의 **Sync** 버튼으로
  다시 동기화할 수 있다.
- 에이전트가 `ruleId` 를 보고하면 Baden 은 규칙 파일이 바뀌었는지 확인하고(프로젝트마다 최대
  30초에 한 번) 자동으로 다시 동기화한다.
- 동기화는 차이만 반영한다. 이름이 바뀐 규칙은 기록을 그대로 유지하고, 삭제된 규칙은 지워지는
  대신 `removed` 로 표시된다.

---

## 서브에이전트에서 보고하기

`tools:` 목록이 제한된 서브에이전트는 `baden_*` MCP 도구를 호출하지 못할 수 있다.
이럴 때는 작은 래퍼 스크립트를 통해 HTTP 로 보고하게 한다.

### 1. 훅 스크립트 만들기

모니터링할 프로젝트에 `.claude/hooks/setup-baden.sh` 를 만든다.

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

`my-project` 는 실제 프로젝트 이름으로 바꾼다.

### 2. 훅 등록

`.claude/settings.local.json` 에서 세션 시작 때 이 스크립트를 실행하고, 서브에이전트가 호출할 수 있도록 허용한다.

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

### 3. 서브에이전트 정의에서 사용

`.claude/agents/my-agent.md` 에 다음과 같이 쓴다.

````markdown
---
name: my-agent
tools: Read, Glob, Grep, Bash
---

## Baden 에 보고하기

모든 행동을 `/tmp/baden-my-project` 를 통해 Baden 에 보고한다.
`baden_*` MCP 도구는 쓰지 않는다 — 언제나 Bash 로 `/tmp/baden-my-project` 를 호출한다.

### 형식

```bash
/tmp/baden-my-project '"action":"check_files","target":"src/index.ts","reason":"대상 파일 확인","taskId":"..."'
```
````

### 4. taskId 전달

메인 에이전트가 서브에이전트를 호출할 때는 프롬프트에 현재 `taskId` 를 반드시 넣어야 한다 — 이를
`CLAUDE.md` 에 적어 둔다. 예: *"사전 검토를 위해 rule-guard 를 호출한다. **프롬프트에 현재 taskId 를
항상 포함한다.**"* 이렇게 하면 서브에이전트의 보고가 메인 에이전트의 작업에 연결된다.

---

## MCP 도구 참조

| 도구 | 호출 시점 | 매개변수 |
|---|---|---|
| `baden_start_task` | 사용자 지시를 받았을 때 | `prompt`, `projectName` → `taskId` 를 돌려준다 |
| `baden_plan` | 계획을 세우거나 접근 방식을 정할 때 | `taskId`, `action`, `reason` |
| `baden_action` | 모든 행동 전에 | `taskId`, `action`, `target?`, `reason?` |
| `baden_verify` | 테스트, 빌드, 린트 등 검사를 마친 뒤 | `taskId`, `action`, `result`, `target?` |
| `baden_rule` | 규칙 확인, 위반, 수정 | `taskId`, `action`, `ruleId`, `severity?`, `target?`, `reason?` |
| `baden_complete_task` | 작업이 끝났을 때 | `taskId`, `summary` |

- `severity` 는 `critical`, `high`, `medium`, `low` 중 하나다.
- 모든 도구는 서버가 꺼져 있어도 `ok: true` 를 돌려준다. 그래서 모니터링이 에이전트를 막는 일은 없다.
  실제로 무슨 일이 있었는지는 `source` 필드로 알 수 있다: `server`, `server_error`, `fallback`.
- `taskId` 와 프로젝트의 연결은 MCP 서버의 메모리에 저장된다. 작업 도중 MCP 서버가 다시 시작되면
  `baden_start_task` 로 새 작업을 시작한다.

### `action` 작성법

`action` 은 자유 형식의 snake_case 다. Baden 은 이를 `_` 로 나누고, 왼쪽부터 훑으면서 **처음으로 알아보는
단어**를 쓴다(`run` 은 건너뛰므로 `run_test` 는 `test` 로 취급된다).

| 단어 | 이벤트 타입 | 레인 | 예시 |
|---|---|---|---|
| `read`, `search`, `scan`, `find`, `trace`, `list`, `identify`, `understand` | `file_read` | Exploration | `read_auth_logic` |
| `plan`, `analyze`, `review`, `decide`, `receive`, `task`, `compile`, `synthesize`, `finalize`, `confirm`, `report`, `adjust` | `task_analysis` | Planning | `plan_refactor` |
| `create` | `code_create` | Implementation | `create_migration` |
| `modify`, `edit`, `delete`, `rewrite`, `add`, `implement`, `update`, `write`, `harden`, `protect`, `apply`, `start`, `continue`, `skip` | `code_modify` | Implementation | `modify_handler` |
| `rule`, `check` | `rule_match` | Rules | `check_c5_compliance` |
| `violation` | `violation_found` | Rules | `violation_found` |
| `fix` | `fix_applied` | Rules | `fix_null_guard` |
| `verify`, `test`, `build`, `typecheck`, `lint`, `validate` | `build_run` | Rules | `test_auth_flow` |

맞는 단어가 없으면, `ruleId` 가 주어진 경우 이벤트는 `rule_match` 가 되고, 그렇지 않으면 일반 `query`
(Exploration 에 표시됨)가 된다. `baden_complete_task` 는 언제나 `task_complete` 를 만든다.

### 타임라인 레인

| 레인 | 들어가는 것 |
|---|---|
| User | 작업을 시작한 지시 (`baden_start_task`) |
| Exploration (탐색) | 코드베이스 읽기와 검색, 그리고 분류되지 않은 이벤트 |
| Planning (계획) | 분석, 결정, 작업 완료 |
| Implementation (구현) | 코드 생성과 수정 |
| Rules | 규칙 확인, 위반, 수정, 검증(테스트, 빌드, 린트) |

레인은 **Registry** 페이지에서 프로젝트마다 바꿀 수 있다(아래 참고).

---

## 대시보드

### Home
- 모든 프로젝트에 걸친 전체 통계와 활동 히트맵
- 이벤트 수와 규칙 수, 카테고리별 구성, 추세선, 에이전트 배지를 담은 프로젝트 카드
- 여러 프로젝트에 걸친 활동 타임라인과 규칙 위반 지도
- 모든 프로젝트에서 들어오는 이벤트의 실시간 피드

### Monitor (프로젝트별)
- 카테고리별 레인과 카테고리 필터 토글
- **빈 구간 압축** — 3분 이상 쉬는 구간을 접어서 바쁜 구간이 잘 보이게 한다
- 화면보다 긴 단일 이벤트를 위한 **긴 이벤트 압축**
- 세 가지 상세 단계(접힘 / 펼침 / 자세히)와 확대 슬라이더(눈금당 1–60초)
- 이동을 돕는 밀도 히트맵이 달린 **미니맵**
- 관성이 있는 드래그 이동, NOW 선을 따라가는 **자동 따라가기**
- **작업 사슬** — 한 작업의 이벤트들을 잇는 화살표
- 30일 활동 히트맵이 달린 날짜 선택기
- 확인 / 위반 / 통과 / 수정 횟수를 보여 주는 **규칙 띠**
- 크기를 조절할 수 있는 **Verification Cycles**(검증 주기) 패널
- 고정하고 크기를 조절할 수 있는 **이벤트 서랍** — 이벤트 상세, 관련 규칙(Markdown 렌더링),
  같은 작업의 다른 이벤트를 보여 준다

### Analysis (프로젝트별)
- 기간: 30일, 90일, 전체
- **Overview**(개요) — 에이전트 효율, 위반 추세, 규칙 품질, 규칙 표(Sync 버튼 포함)
- **Insights**(통찰) — 행동 흐름, 단계별 시간 분포, 작업 소요 시간, 시간대별 활동, 일별
  생산성, 작업 복잡도, 위반 패턴, 핫스팟 파일, 규칙 동시 발생, 위반 이야기
- **규칙 상세** — 주간 추세, 가장 많이 어긴 파일, 위반 기록, 규칙 내용

### Compare
두 개 이상의 프로젝트를 나란히 비교한다: Workflow DNA, 생산성 타임라인, 작업 지표와
소요 시간 분포, 규칙 준수, 가장 많이 어긴 규칙, 규칙 위반 히트맵.

### Registry (프로젝트별)
프로젝트 하나에 대해 행동이 레인으로 묶이는 방식을 바꾼다.
- **Action prefixes**(행동 접두어)는 행동의 첫 단어(`read_`, `create_`, ...)를 레인에 짝지어 준다
- **Detail keywords**(세부 키워드)는 행동의 뒤쪽 단어를 보고 그 선택을 더 다듬는다

### 알림
작업이 끝나면(`baden_complete_task`) 브라우저가 알림을 띄운다.

---

## Baden 실행

### CLI

| 명령 | 설명 |
|---|---|
| `baden` | `baden status` 와 같다 |
| `baden install [-p port]` | LaunchAgent 를 등록하고 시작한다 (로그인할 때마다 시작된다) |
| `baden uninstall` | LaunchAgent 등록을 해제한다. `~/.baden`(데이터베이스, 로그)은 남는다 |
| `baden start [-p port]` | 시작한다 — 서비스가 설치되어 있으면 서비스를, 아니면 백그라운드 데몬을 띄운다 |
| `baden stop` | 멈춘다. 설치된 서비스는 다음 로그인 때 다시 시작된다 |
| `baden restart` | 다시 시작한다 |
| `baden status` | 상태를 보여 주고 상태 점검을 실행한다 |
| `baden run [-p port] [--force]` | 콘솔에 로그를 찍으며 포그라운드로 실행한다 |
| `baden dev` | 핫 리로드 개발 모드 (아래 참고) |
| `baden logs` | 가장 최근 일별 로그를 `tail -f` 한다 |

- `start`, `stop`, `status` 는 설치된 서비스를 알아채고 `launchctl` 에 맡긴다. 그래서 서비스와
  데몬이 포트와 데이터베이스를 두고 다투는 일이 없다.
- 설치된 서비스의 포트는 plist 에 고정된다. 바꾸려면 `baden install -p <port>` 를 다시 실행한다.
  `start`/`stop`/`restart`/`status` 에 붙인 `-p` 는 경고만 출력한다.
- `baden run` 은 서비스나 데몬이 실행 중이면 시작을 거부한다. `--force` 로 이를 무시할 수 있다.

### 서비스 동작 방식

- launchd 는 로그인 셸을 거치지 않으므로 nvm 으로 설치한 Node.js 를 찾지 못한다.
  `baden install` 은 현재 `node` 바이너리를 `~/.baden/runtime/node` 로 복사하고, plist 는 그 복사본으로
  `bin/daemon.js` 를 바로 실행한다. **Node.js 버전을 바꾼 뒤에는 `baden install` 을 다시 실행한다.**
- plist 는 설치 시점에 `PORT`, `DB_PATH`, `CLIENT_DIR` 을 고정하고, 비정상 종료 때만 서버를 다시
  시작한다(`KeepAlive: { SuccessfulExit: false }`). launchd 출력은 `~/.baden/logs/launchd.log` 로 간다.
- `baden install` 은 포트가 이미 쓰이고 있으면 실행을 거부하고, 이후 `/api/health` 를 최대 15초 기다린다.

### ⚠️ 서비스는 `dist` 를 실행한다

`baden dev` 는 `tsx` 로 `src` 를 바로 실행하지만, **서비스는 빌드 결과물(`server/dist`)을 실행한다.**
소스를 바꾼 뒤에는 다시 빌드하고 재시작한다.

```bash
npm run build
baden restart
```

`baden install`, `start`, `restart`, `status` 는 `dist` 가 `src` 보다 오래되었으면 경고한다.

### 문제 해결

- **저장소를 옮겼는가?** plist 는 옛 경로를 가리킨다. `baden status` 가 이를 알아챈다 — `baden install` 을 다시 실행한다.
- **`~/Documents` 아래에서 권한 오류가 나는가?** macOS 개인정보 보호(TCC)가 가끔 접근을 막을 수 있다.
  `baden install` 은 `launchd.log` 에서 이를 알아채고, `~/.baden/runtime/node` 에 전체 디스크 접근 권한을
  주는 방법을 출력한다.
- **포트가 이미 쓰이고 있는가?** `lsof -nP -iTCP:3800 -sTCP:LISTEN` 으로 누가 잡고 있는지 볼 수 있다.

### 개발 모드

```bash
baden dev
```

서비스를 잠시 멈추고 핫 리로드 서버들을 띄운다.

- 서버: http://localhost:3800 (`tsx watch`, `src` 를 바로 실행)
- 클라이언트: http://localhost:3801 (Vite, `/api` 와 `/ws` 를 3800 포트로 넘긴다)

**Ctrl+C 를 누르면(또는 터미널을 닫으면) 서비스가 돌아온다.** 자식 프로세스는 그룹 단위로 정리되므로
남는 것이 없다. `baden dev` 는 `server/` 와 `client/` 의 의존성이 설치되어 있어야 한다 —
없으면 `npm ci` 를 실행하라고 알려 준다.

각 부분을 따로 실행하려면:

```bash
npm run dev:server    # http://localhost:3800
npm run dev:client    # http://localhost:3801
```

### 환경 변수

| 변수 | 사용하는 곳 | 기본값 |
|---|---|---|
| `PORT` | 서버 | `3800` |
| `DB_PATH` | 서버 | `~/.baden/baden.db` |
| `CLIENT_DIR` | 서버 | `<repo>/client/dist` (CLI 가 설정) |
| `BADEN_API_URL` | MCP 서버 | `http://localhost:3800` |

`server/dist/index.js` 를 직접 띄운다면 `CLIENT_DIR` 을 `<repo>/client/dist` 로 설정한다. 그렇지 않으면 대시보드가 제공되지 않는다.

---

## API

모든 엔드포인트는 `http://localhost:3800` 아래에 있다.

### 프로젝트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/projects` | 프로젝트 생성 — `{ name*, description?, rulesPath?, agent? }`. `rulesPath` 가 있으면 규칙을 바로 동기화한다 |
| `GET` | `/api/projects` | 프로젝트 목록 |
| `GET` | `/api/projects/:id` | 규칙을 포함한 프로젝트 상세 (`?includeRemoved=1` 이면 제거된 규칙도 포함) |
| `PUT` | `/api/projects/:id` | 프로젝트 수정 (규칙을 다시 동기화한다) |
| `DELETE` | `/api/projects/:id` | 프로젝트와 그 모든 데이터를 삭제 |
| `GET` | `/api/projects/:id/rules` | 규칙 목록 (`?includeRemoved=1`) |
| `GET` | `/api/projects/:id/rules/:ruleId` | 타입별 통계를 포함한 규칙 상세 |
| `GET` | `/api/projects/:id/rules/:ruleId/content` | Markdown 형식의 규칙 본문 |
| `PUT` | `/api/projects/:id/sync` | `rulesPath` 에서 규칙을 다시 동기화 |

### 이벤트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/query` | 에이전트 행동 보고 (단일 또는 배열) — `{ projectName*, action*, target?, reason?, ruleId?, severity?, taskId?, ... }`. 언제나 `{ ok: true }` 를 돌려준다. 알 수 없는 프로젝트 이름은 로그에 남기고 버린다 |
| `POST` | `/api/events` | 원시 이벤트 삽입 (단일 또는 배열). `type` 과 `projectId` 가 필요하다 — 에이전트 보고에는 `/api/query` 를 쓴다 |
| `GET` | `/api/events` | 이벤트 조회 — `projectId`, `type`, `ruleId`, `taskId`, `date` (YYYY-MM-DD), `limit` (기본값 100), `offset` |
| `GET` | `/api/events/dates` | 이벤트가 있는 날짜와 그 개수 (`?projectId`) |

### 분석

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/insights` | 홈 대시보드용 전체 프로젝트 요약 |
| `GET` | `/api/analytics/rules/effectiveness` | `projectId*`, `ruleId?`, `days?` (기본값 90) |
| `GET` | `/api/analytics/rules/quality` | `projectId*` |
| `GET` | `/api/analytics/rules/:ruleId` | `projectId*` |
| `GET` | `/api/analytics/agent/efficiency` | `projectId*`, `days?` (기본값 90) |
| `GET` | `/api/analytics/insights` | `projectId*`, `days?` (기본값 90, `0` 이면 전체 기간) |
| `GET` | `/api/analytics/compare` | `projectIds=a,b` |
| `GET` | `/api/analytics/compare/deep` | `projectIds=a,b` |

### 행동 레지스트리

모두 `/api/projects/:projectId/action-registry` 아래에 있다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET`, `POST` | `/` | 행동 패턴 목록 / 생성 |
| `PUT`, `DELETE` | `/:id` | 패턴 수정 / 삭제 |
| `POST` | `/bulk` | 패턴 일괄 확정 (`{ ids: [] }`) |
| `POST` | `/test` | 패턴 시험 (`{ pattern, pattern_type }`) |
| `GET`, `POST` | `/prefixes` | 행동 접두어 목록 / 생성 |
| `PUT`, `DELETE` | `/prefixes/:id` | 접두어 수정 / 삭제 |
| `GET`, `POST` | `/keywords` | 세부 키워드 목록 / 생성 |
| `PUT`, `DELETE` | `/keywords/:id` | 키워드 수정 / 삭제 |

### 기타

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/health` | `{ status: "ok", timestamp }` |
| `WS` | `/ws?projectId=<id>` | 실시간 이벤트(`{ type: "event", data }`)와 레지스트리 변경 알림. `projectId` 를 빼면 모든 프로젝트의 이벤트를 받는다 |

---

## 기술 스택

- **서버**: Node.js, Express, TypeScript, WebSocket (`ws`), SQLite (`better-sqlite3`)
- **클라이언트**: React 19, Vite 7, Tailwind CSS v4, Recharts, Radix UI, Phosphor Icons, react-router
- **MCP**: `@modelcontextprotocol/sdk` (stdio 전송)
- **포트**: 서버 `3800`, 클라이언트 개발 서버 `3801`
