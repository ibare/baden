# Baden

AI 코딩 에이전트의 행동을 실시간으로 모니터링하는 로컬 도구.

에이전트가 파일을 읽고, 코드를 수정하고, 테스트를 돌리는 모든 과정을 이벤트로 수집하여
타임라인, 규칙 히트맵, 요약 대시보드로 시각화한다.

## 핵심 컨셉

### 자유 서술 → 사후 분류

에이전트는 고정된 이벤트 타입을 외울 필요 없이, 자신의 행동을 **자유로운 키워드**로 보고한다.
서버는 `inferEventType()`에서 정규표현식 패턴 매칭으로 이를 내부 이벤트 타입(`file_read`)으로 **사후 분류**한다.
에이전트의 자유도와 Baden의 정형화된 분석을 양립시키는 설계.

### 보고 → 확인 → 실행

에이전트는 모든 행동을 **실행 전에** Baden에 보고한다.
파일 읽기, 검색, 코드 수정, 테스트 실행 등 예외 없이 사전 보고 원칙을 따른다.

### 규칙 기반 모니터링

프로젝트의 코딩 규칙(`rules/` 디렉토리)을 파싱하여 등록하고,
에이전트가 규칙을 참조(match)했는지, 위반(violation)했는지, 수정(fix)했는지를 추적한다.

## 아키텍처

```
AI 에이전트 (Claude Code, ...)
    │
    │  MCP 도구 호출 (stdio)
    ▼
Baden MCP Server ──HTTP──▶ POST /api/query ─── inferEventType() ─── event-processor ─── SQLite
                                                      │
                                                 WebSocket broadcast
                                                      │
                                                      ▼
                                               React 대시보드
                                           (타임라인 · 히트맵 · 로그)
```

## 이벤트 카테고리

| 카테고리 | 이벤트 타입 | 설명 |
|----------|------------|------|
| 탐색 | `code_search`, `file_read`, `doc_read`, `dependency_check` | 코드베이스를 읽거나 검색 |
| 계획 | `task_analysis`, `approach_decision`, `task_complete` | 요구사항 분석, 구현 방식 결정, 작업 완료 |
| 구현 | `code_create`, `code_modify`, `refactor`, `file_write` | 코드 작성 및 수정 |
| 검증 | `test_run`, `build_run`, `lint_run` | 테스트, 빌드, 린트 실행 |
| 디버깅 | `error_encountered`, `error_resolved` | 오류 발생 및 해결 |
| 규칙 | `rule_match`, `violation_found`, `fix_applied` | 규칙 참조, 위반 발견, 수정 |

## 기술 스택

- **Server**: Node.js + Express + TypeScript + WebSocket(ws) + SQLite(better-sqlite3)
- **Client**: React 19 + Vite + Tailwind CSS v4 + Recharts + Radix UI + Phosphor Icons + react-router-dom
- **Ports**: Server `3800`, Client dev `3801`

## 시작하기

```bash
# 의존성 설치
npm install

# 서버 + 클라이언트 동시 실행
npm run dev
```

### 프로젝트 등록

```bash
curl -X POST http://localhost:3800/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"my-project","rulesPath":"/path/to/rules"}'
```

등록 후 응답의 `id` (예: `bdn_RpvGbbyN`)를 아래 설정에서 사용한다.

### 에이전트 설정 (Claude Code MCP)

#### 1. MCP 서버 빌드

```bash
npm run build:mcp
```

#### 2. MCP 서버 연결

모니터링할 프로젝트 루트에 `.mcp.json` 생성:

```json
{
  "mcpServers": {
    "baden": {
      "command": "node",
      "args": ["/path/to/baden/mcp/dist/index.js"],
      "env": {
        "BADEN_API_URL": "http://localhost:3800",
        "BADEN_PROJECT_ID": "<프로젝트 ID>"
      }
    }
  }
}
```

#### 3. CLAUDE.md에 행동 규칙 추가

MCP 도구가 연결되어도 에이전트가 **자동으로** 매번 호출하지는 않는다. 모니터링할 프로젝트의 `CLAUDE.md`에 아래 지침을 추가하여 보고를 강제한다:

```markdown
## Baden Monitoring

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

## API

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/projects` | 프로젝트 등록 |
| `GET` | `/api/projects` | 프로젝트 목록 |
| `GET` | `/api/projects/:id` | 프로젝트 상세 |
| `GET` | `/api/projects/:id/rules` | 규칙 목록 |
| `PUT` | `/api/projects/:id/sync` | 규칙 디렉토리 재스캔 |
| `POST` | `/api/query` | 에이전트 행동 보고 (자유 서술) |
| `POST` | `/api/events` | 이벤트 직접 수신 (단건/배치) |
| `GET` | `/api/events` | 이벤트 조회 (projectId, type, date 등 필터) |
| `GET` | `/api/events/dates` | 이벤트가 존재하는 날짜 목록 |
| `GET` | `/api/projects/:projectId/action-registry` | 액션 패턴 목록 |
| `POST` | `/api/projects/:projectId/action-registry` | 액션 패턴 생성 |
| `GET` | `/api/projects/:projectId/action-registry/prefixes` | 액션 접두사 목록 |
| `POST` | `/api/projects/:projectId/action-registry/prefixes` | 액션 접두사 생성 |
| `WS` | `/ws?projectId=<id>` | 실시간 이벤트 스트리밍 |

## 주요 기능

### 타임라인 시각화
- 카테고리별 **레인(lane)** 분리 — 탐색, 계획, 구현, 검증, 디버깅, 규칙 준수
- **Gap 압축** — 유휴 시간 구간을 접어 밀도 높은 뷰 제공
- **긴 이벤트 압축** — 뷰포트를 초과하는 단일 이벤트 처리
- **3단계 확장 토글** — 축소 / 확장 / 상세
- **미니맵** — 전체 타임라인 오버뷰 + 네비게이션
- **마우스 드래그 패닝** — 관성 스크롤 지원
- **이벤트 타입 아이콘** — Phosphor Icons 기반 시각적 구분
- **이벤트 선택 아웃라인** — 사이드바 연동 시각 피드백
- **태스크 체인 연결선** — L자형 라우팅 + 화살표

### 액션 레지스트리
- **접두사/상세 2단계 분류** — `read_`, `create_` 등 접두사로 광역 분류 후 세부 패턴 매칭
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

## 프로젝트 구조

```
baden/
├── mcp/                            # MCP 서버 (Claude Code 연동)
│   └── src/
│       ├── index.ts               # MCP 서버 진입점 (stdio transport)
│       ├── client.ts              # Baden REST API HTTP 클라이언트
│       └── tools.ts               # 6개 도구 정의 (스키마 + 핸들러)
├── server/
│   └── src/
│       ├── index.ts                # Express + WebSocket 서버
│       ├── ws.ts                   # WebSocket 클라이언트 관리
│       ├── db/
│       │   ├── connection.ts       # SQLite 연결 + 스키마 초기화
│       │   └── schema.ts           # 스키마 정의
│       ├── routes/
│       │   ├── projects.ts         # 프로젝트 CRUD
│       │   ├── events.ts           # 이벤트 수신/조회
│       │   ├── query.ts            # Query 프로토콜 (inferEventType)
│       │   └── action-registry.ts  # 액션 패턴 관리
│       └── services/
│           ├── rule-parser.ts      # INDEX.yaml + 규칙 파싱
│           ├── event-processor.ts  # 이벤트 저장 + broadcast
│           └── action-registry.ts  # 액션 레지스트리 로직
├── client/
│   └── src/
│       ├── pages/
│       │   └── ActionRegistryPage.tsx  # 액션 레지스트리 관리
│       ├── components/
│       │   ├── layout/             # AppLayout, RootLayout, Sidebar, TopBar
│       │   ├── timeline/           # 타임라인 시각화 (Bar, Marker, Grid, Minimap, ...)
│       │   ├── domain/             # ActionRegistryPanel, CreateProjectDialog, ...
│       │   ├── ui/                 # Radix UI 기반 공통 컴포넌트
│       │   ├── EventDrawer.tsx     # 이벤트/규칙 상세 사이드바
│       │   ├── RuleHeatmap.tsx     # 규칙 히트맵
│       │   └── ProjectHeader.tsx   # 프로젝트 헤더
│       ├── hooks/
│       │   ├── useWebSocket.ts     # WebSocket 연결 훅
│       │   ├── useActionRegistry.ts # 액션 레지스트리 상태
│       │   └── useProjectContext.tsx # 프로젝트 컨텍스트
│       └── lib/
│           ├── api.ts              # API 클라이언트
│           └── event-types.ts      # 이벤트 타입 정의
└── data/
    └── baden.db                    # SQLite DB (자동 생성)
```
