# Baden

AI 코딩 에이전트의 행동을 실시간으로 모니터링하는 로컬 도구.

에이전트가 파일을 읽고, 코드를 수정하고, 테스트를 돌리는 모든 과정을 이벤트로 수집하여
타임라인, 규칙 히트맵, 요약 대시보드로 시각화한다.

## 핵심 컨셉

### 자유 서술 → 사후 분류

에이전트는 고정된 이벤트 타입을 외울 필요 없이, 자신의 행동을 **자유로운 키워드**로 보고한다.

```bash
/tmp/baden '"action":"read_oauth_login_logic","target":"src/auth/login.ts","reason":"토큰 갱신 로직 확인"'
```

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
AI 에이전트 (Claude Code, Cursor, ...)
    │
    │  /tmp/baden 스크립트 (curl wrapper)
    ▼
POST /api/query ─── inferEventType() ─── event-processor ─── SQLite
    │                                          │
    │                                     WebSocket broadcast
    ▼                                          │
{ ok: true }                                   ▼
                                        React 대시보드
                                    (타임라인 · 히트맵 · 로그)
```

## 이벤트 카테고리

| 카테고리 | 이벤트 타입 | 설명 |
|----------|------------|------|
| 탐색 | `code_search`, `file_read`, `doc_read`, `dependency_check` | 코드베이스를 읽거나 검색 |
| 계획 | `task_analysis`, `approach_decision` | 요구사항 분석, 구현 방식 결정 |
| 구현 | `code_create`, `code_modify`, `refactor`, `file_write` | 코드 작성 및 수정 |
| 검증 | `test_run`, `build_run`, `lint_run` | 테스트, 빌드, 린트 실행 |
| 디버깅 | `error_encountered`, `error_resolved` | 오류 발생 및 해결 |
| 규칙 | `rule_match`, `violation_found`, `fix_applied` | 규칙 참조, 위반 발견, 수정 |

## 기술 스택

- **Server**: Node.js + Express + TypeScript + WebSocket(ws) + SQLite(better-sqlite3)
- **Client**: React + Vite + Tailwind CSS v4 + Recharts
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

### 에이전트에 프로토콜 적용

1. 대시보드에서 프로젝트 선택
2. **"Baden 프로토콜 복사"** 버튼 클릭
3. 복사된 텍스트를 `CLAUDE.md` 또는 에이전트의 시스템 프롬프트에 붙여넣기

## API

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/projects` | 프로젝트 등록 |
| `GET` | `/api/projects` | 프로젝트 목록 |
| `GET` | `/api/projects/:id` | 프로젝트 상세 |
| `GET` | `/api/projects/:id/instruction` | 에이전트용 프로토콜 텍스트 |
| `GET` | `/api/projects/:id/rules` | 규칙 목록 |
| `PUT` | `/api/projects/:id/sync` | 규칙 디렉토리 재스캔 |
| `POST` | `/api/query` | 에이전트 행동 보고 (자유 서술) |
| `POST` | `/api/events` | 이벤트 직접 수신 |
| `GET` | `/api/events` | 이벤트 조회 |
| `WS` | `/ws?projectId=<id>` | 실시간 이벤트 스트리밍 |

## 프로젝트 구조

```
baden/
├── server/
│   └── src/
│       ├── index.ts              # Express + WebSocket 서버
│       ├── ws.ts                 # WebSocket 클라이언트 관리
│       ├── db/connection.ts      # SQLite 연결 + 스키마
│       ├── routes/
│       │   ├── projects.ts       # 프로젝트 CRUD + instruction
│       │   ├── events.ts         # 이벤트 수신/조회
│       │   └── query.ts          # Query 프로토콜 (inferEventType)
│       └── services/
│           ├── instruction.ts    # 에이전트 프로토콜 지시 생성
│           ├── rule-parser.ts    # INDEX.yaml + 규칙 파싱
│           └── event-processor.ts # 이벤트 저장 + broadcast
├── client/
│   └── src/
│       ├── pages/
│       │   └── LiveMonitor.tsx   # 실시간 대시보드
│       ├── components/
│       │   ├── EventTimeline.tsx  # 이벤트 타임라인
│       │   ├── RuleHeatmap.tsx    # 규칙 히트맵
│       │   ├── SummaryCards.tsx   # 카테고리별 요약
│       │   └── EventLog.tsx       # 상세 로그 테이블
│       └── hooks/
│           └── useWebSocket.ts    # WebSocket 연결 훅
└── data/
    └── baden.db                   # SQLite DB (자동 생성)
```
