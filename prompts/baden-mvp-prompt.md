# Baden MVP 구현 지시서 (Phase 1)

## 프로젝트 개요

**Baden**은 AI 코딩 에이전트(Claude Code 등)가 프로젝트 규칙을 참조/위반/수정하는 과정을 실시간으로 시각화하고, 이력을 축적하여 규칙 품질과 에이전트 효율을 분석하는 로컬 모니터링 도구다.

이름은 보이스카우트 창시자 Robert Baden-Powell에서 따왔다. 에이전트의 작업을 정찰하고 가이드하는 도구라는 의미.

---

## 기술 스택

| 구성 | 기술 |
|------|------|
| 서버 | Node.js + Express + TypeScript |
| 실시간 | WebSocket (ws) |
| DB | SQLite (better-sqlite3) |
| 프론트엔드 | React + Vite + Tailwind CSS |
| 차트 | Recharts |
| 패키지 | 모노레포 없이 단일 프로젝트, 서버와 클라이언트 분리 |

---

## 디렉토리 구조

```
baden/
├── server/
│   ├── src/
│   │   ├── index.ts              # Express + WebSocket 서버 진입점
│   │   ├── db/
│   │   │   ├── schema.ts         # SQLite 테이블 생성
│   │   │   └── connection.ts     # better-sqlite3 인스턴스
│   │   ├── routes/
│   │   │   ├── projects.ts       # 프로젝트 등록/조회/규칙 파싱
│   │   │   ├── events.ts         # 이벤트 수신/조회
│   │   │   ├── sessions.ts       # 세션(작업) 조회
│   │   │   └── analysis.ts       # 분석 API (Phase 2 준비)
│   │   ├── services/
│   │   │   ├── rule-parser.ts    # INDEX.yaml + 규칙 파일 파싱
│   │   │   ├── template.ts       # 프롬프트 템플릿 생성
│   │   │   └── event-processor.ts # 이벤트 처리 + WebSocket 브로드캐스트
│   │   └── types.ts              # 공유 타입 정의
│   ├── package.json
│   └── tsconfig.json
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── LiveMonitor.tsx   # 실시간 모니터링
│   │   │   ├── Sessions.tsx      # 세션(작업) 목록
│   │   │   └── SessionDetail.tsx # 세션 상세 + 타임라인
│   │   ├── components/
│   │   │   ├── EventTimeline.tsx  # 이벤트 타임라인
│   │   │   ├── RuleHeatmap.tsx    # 규칙 히트맵
│   │   │   ├── SummaryCards.tsx   # 요약 카드
│   │   │   └── EventLog.tsx       # 상세 로그 테이블
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts    # WebSocket 연결 훅
│   │   └── lib/
│   │       └── api.ts             # API 클라이언트
│   ├── package.json
│   └── vite.config.ts
├── data/                          # SQLite DB 파일 위치
│   └── .gitkeep
└── README.md
```

---

## DB 스키마 (SQLite)

```sql
-- 프로젝트
CREATE TABLE projects (
  id TEXT PRIMARY KEY,                    -- 자동 생성 (nanoid 8자리)
  name TEXT NOT NULL,
  description TEXT,
  rules_path TEXT NOT NULL,               -- rules 디렉토리 절대 경로
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 프로젝트에 등록된 규칙
CREATE TABLE rules (
  id TEXT NOT NULL,                       -- 규칙 ID (예: "C2", "S-konva", "principles")
  project_id TEXT NOT NULL REFERENCES projects(id),
  category TEXT NOT NULL,                 -- "always" | "concerns" | "specifics"
  file_path TEXT NOT NULL,                -- 상대 경로 (예: "concerns/error-handling.md")
  description TEXT,
  triggers TEXT,                          -- JSON: { paths, patterns, imports, events }
  content_hash TEXT,                      -- 파일 내용 해시 (변경 감지용)
  parsed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (id, project_id)
);

-- 세션 (= 하나의 에이전트 작업 단위)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                    -- 에이전트가 생성하는 세션 ID
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_prompt TEXT,                       -- 사용자 작업 프롬프트 (템플릿 제외)
  status TEXT DEFAULT 'active',           -- "active" | "completed" | "error"
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  event_count INTEGER DEFAULT 0,
  violation_count INTEGER DEFAULT 0,
  fix_count INTEGER DEFAULT 0
);

-- 이벤트
CREATE TABLE events (
  id TEXT PRIMARY KEY,                    -- UUID (서버 생성)
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,                     -- EventType
  project_id TEXT NOT NULL REFERENCES projects(id),
  session_id TEXT REFERENCES sessions(id),

  -- 규칙 관련
  rule_id TEXT,                           -- 규칙 ID (예: "C2")
  severity TEXT,                          -- "critical" | "high" | "medium" | "low"

  -- 파일 관련
  file TEXT,
  line INTEGER,

  -- 상세
  message TEXT,
  detail TEXT,
  action TEXT,

  -- 메타
  agent TEXT,                             -- "claude-code" | "cursor" 등
  step TEXT,                              -- Step 이름
  duration_ms INTEGER
);

CREATE INDEX idx_events_project ON events(project_id);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_rule ON events(rule_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
```

---

## 핵심 기능 구현

### 1. 프로젝트 등록 + Rules 파싱

#### API: `POST /api/projects`

```typescript
// Request body
{
  name: string;          // "methii"
  description?: string;
  rulesPath: string;     // "/Users/mintae/projects/methii/rules"
}

// Response
{
  id: string;            // "bdn_a1b2c3d4"
  name: string;
  rulesPath: string;
  rules: ParsedRule[];   // 파싱된 규칙 목록
  template: string;      // 생성된 프롬프트 템플릿
}
```

#### Rules 파싱 로직 (`rule-parser.ts`)

rules 디렉토리 구조는 다음과 같다:

```
rules/
├── INDEX.yaml          # 규칙 레지스트리 (트리거 조건 정의)
├── principles.md       # 항상 로드되는 핵심 원칙
├── CLAUDE.md           # 프로젝트 구조 정보
├── concerns/           # 교차 관심사 규칙 (C1~C9)
│   ├── error-handling.md
│   ├── singleton-instances.md
│   └── ...
└── specifics/          # 도메인 전용 규칙 (S-*)
    ├── react-query.md
    ├── konva-rendering.md
    └── ...
```

**INDEX.yaml 파싱 규칙:**

```yaml
# always 섹션: id 없음, category="always"
always:
  - file: principles.md
    description: 모든 코드에 적용되는 6개 핵심 원칙

# concerns 섹션: id는 "C1"~"C9" 형태
concerns:
  - id: C3
    file: concerns/error-handling.md
    description: 에러 처리 표준
    triggers:
      patterns: ["ApiResponse", "ApiError", ...]
      imports: ["@/types/api-response.types"]

# specifics 섹션: id는 "S-*" 형태
specifics:
  - id: S-react-query
    file: specifics/react-query.md
    description: React Query 훅, 캐시 정책
    triggers:
      paths: ["apps/web/src/queries/**"]
      imports: ["@tanstack/react-query"]
```

파싱 시 수행할 작업:
1. INDEX.yaml을 읽어 모든 규칙 항목 추출
2. 각 규칙의 file 경로로 실제 .md 파일 존재 여부 확인
3. .md 파일의 frontmatter에서 version, last_verified 추출 (선택)
4. 파일 내용의 SHA-256 해시 계산 (content_hash)
5. always 항목은 id가 없으므로 파일명에서 생성 (예: "principles", "claude-md")
6. 모든 정보를 rules 테이블에 저장
7. triggers 필드는 JSON 문자열로 저장

#### 규칙 파일(.md) 구조 참고

각 규칙 파일은 다음 구조를 따른다 (파싱은 하지 않으나, 에이전트가 참조하는 형태를 이해해야 함):

```markdown
---
version: 2
last_verified: 2026-02-21
---

# 규칙 제목 (규칙 ID)

## 적용 조건
## MUST (반드시)
## MUST NOT (금지)
## PREFER (권장)
## 예시
## 안티패턴
## 앱별 변형
```

---

### 2. 프롬프트 템플릿 생성 (`template.ts`)

프로젝트 등록 후, Baden은 해당 프로젝트 전용 프롬프트 템플릿을 생성한다. 사용자는 이 템플릿을 Claude Code 작업 시 프롬프트 앞에 붙여 사용한다.

#### API: `GET /api/projects/:id/template`

생성되는 템플릿 형태:

```
--- BADEN TEMPLATE START ---
[Baden 모니터링 프로토콜]
프로젝트: {project_name} (ID: {project_id})
Baden 서버: http://localhost:3800

이 작업은 Baden이 모니터링한다. 아래 규칙에 따라 작업 중 이벤트를 전송하라.
전송 실패 시 무시하고 작업을 계속하라. 출력을 숨겨라.

[세션 시작 — 작업 최초 1회]
1. 세션 ID를 생성하라 (형식: YYYYMMDD-HHmmss-간단한설명, 예: 20260222-143000-auth-refactor)
2. 아래 USER TASK 부분의 내용을 /tmp/baden_prompt.txt 에 저장하라.
3. 세션 시작 이벤트를 전송하라:
curl -s -X POST http://localhost:3800/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"session_start","projectId":"{project_id}","sessionId":"[세션ID]","agent":"claude-code"}' \
  > /dev/null 2>&1
4. 사용자 프롬프트를 전송하라:
curl -s -X POST http://localhost:3800/api/sessions/[세션ID]/prompt \
  -F "file=@/tmp/baden_prompt.txt" \
  > /dev/null 2>&1

[규칙 매칭 — 규칙 파일을 읽거나 참조할 때마다]
curl -s -X POST http://localhost:3800/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"rule_match","projectId":"{project_id}","sessionId":"[세션ID]","ruleId":"[규칙ID]","file":"[대상파일]"}' \
  > /dev/null 2>&1

[위반 발견 — 규칙 위반을 발견할 때마다]
curl -s -X POST http://localhost:3800/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"violation_found","projectId":"{project_id}","sessionId":"[세션ID]","ruleId":"[규칙ID]","file":"[파일]","severity":"[critical|high|medium|low]","message":"[위반 내용]"}' \
  > /dev/null 2>&1

[수정 적용 — 위반을 수정할 때마다]
curl -s -X POST http://localhost:3800/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"fix_applied","projectId":"{project_id}","sessionId":"[세션ID]","ruleId":"[규칙ID]","file":"[파일]","message":"[수정 내용]"}' \
  > /dev/null 2>&1

[파일 읽기/쓰기 — 파일을 읽거나 수정할 때]
curl -s -X POST http://localhost:3800/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"file_read|file_write","projectId":"{project_id}","sessionId":"[세션ID]","file":"[파일경로]"}' \
  > /dev/null 2>&1

[세션 종료 — 모든 작업 완료 후]
curl -s -X POST http://localhost:3800/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"session_end","projectId":"{project_id}","sessionId":"[세션ID]"}' \
  > /dev/null 2>&1

등록된 규칙 목록:
{규칙 ID 목록과 설명을 나열}
--- BADEN TEMPLATE END ---

--- USER TASK ---
(여기에 실제 작업 지시를 작성)
--- USER TASK END ---
```

---

### 3. 이벤트 수신 + 실시간 브로드캐스트

#### API: `POST /api/events`

```typescript
// Request body (단건)
{
  type: EventType;
  projectId: string;
  sessionId: string;
  ruleId?: string;
  severity?: Severity;
  file?: string;
  line?: number;
  message?: string;
  detail?: string;
  action?: string;
  agent?: string;
  step?: string;
  durationMs?: number;
}

// Request body (배열)도 허용
[{ ... }, { ... }]
```

처리 흐름:
1. UUID 생성, timestamp 기록
2. events 테이블에 INSERT
3. type에 따라 sessions 테이블 카운터 업데이트:
   - `session_start` → sessions INSERT (status='active')
   - `violation_found` → sessions.violation_count += 1
   - `fix_applied` → sessions.fix_count += 1
   - `session_end` → sessions.status = 'completed', ended_at 기록
   - 모든 이벤트 → sessions.event_count += 1
4. WebSocket으로 연결된 모든 클라이언트에 이벤트 브로드캐스트

#### API: `POST /api/sessions/:sessionId/prompt`

사용자 프롬프트 파일 수신 (multipart/form-data).
sessions 테이블의 user_prompt 컬럼에 저장.

#### API: `GET /api/events`

```
GET /api/events?projectId=bdn_a1b2&sessionId=20260222-143000-auth&type=violation_found&ruleId=C2&limit=100&offset=0
```

#### WebSocket: `ws://localhost:3800/ws`

```typescript
// 연결 시 쿼리 파라미터로 필터링
ws://localhost:3800/ws?projectId=bdn_a1b2

// 서버 → 클라이언트 메시지
{
  type: "event",
  data: RuleEvent
}
```

---

### 4. 프론트엔드 대시보드

#### 화면 1: 실시간 모니터 (LiveMonitor)

URL: `/`

레이아웃:
```
┌─ 헤더: Baden 로고 + 프로젝트 셀렉터 + 세션 셀렉터 ─────────┐
├─────────────────────────────────────────────────────────────────┤
│ [요약 카드] 이벤트 N | 매칭 N | 위반 N | 수정 N              │
├─────────────────────────────────────────────────────────────────┤
│ [타임라인 (좌 60%)]          │ [규칙 히트맵 (우 40%)]         │
│  시간순 이벤트 스트림          │  규칙별 상태 색상 그리드        │
│  타입별 아이콘/색상 구분       │  매칭=회색, 위반=빨강, 수정=초록│
│  자동 스크롤                  │  클릭 시 규칙 상세로 이동       │
├─────────────────────────────────────────────────────────────────┤
│ [상세 로그] 필터: 타입, 규칙, 심각도 | 검색                    │
│  테이블: 시간, 타입, 규칙, 파일, 메시지                       │
└─────────────────────────────────────────────────────────────────┘
```

- WebSocket으로 실시간 업데이트
- 요약 카드는 숫자가 올라갈 때 애니메이션
- 타임라인은 최신 이벤트가 위, 자동 스크롤 (사용자가 스크롤 올리면 일시 정지)
- 히트맵은 규칙 ID 그리드, 이벤트 발생 시 해당 셀 색상 변경

#### 화면 2: 세션 목록 (Sessions)

URL: `/sessions`

- 프로젝트별 세션 목록 (최신순)
- 각 세션: ID, 시작시간, 상태, 이벤트/위반/수정 카운트, 사용자 프롬프트 미리보기
- 클릭 시 세션 상세로 이동

#### 화면 3: 세션 상세 (SessionDetail)

URL: `/sessions/:sessionId`

- 세션 요약: 프롬프트, 시작/종료 시간, 소요 시간
- 타임라인 (전체 이벤트)
- 규칙별 집계: 이 세션에서 어떤 규칙이 몇 번 매칭/위반/수정되었는지
- 파일별 집계: 어떤 파일이 가장 많이 수정되었는지

---

### 5. 프로젝트/규칙 조회 API

```
GET /api/projects                     — 프로젝트 목록
GET /api/projects/:id                 — 프로젝트 상세 (규칙 포함)
GET /api/projects/:id/template        — 프롬프트 템플릿
GET /api/projects/:id/rules           — 규칙 목록
GET /api/projects/:id/rules/:ruleId   — 규칙 상세 + 이벤트 통계
PUT /api/projects/:id/sync            — rules 디렉토리 재스캔 (규칙 변경 반영)
```

---

## 서버 포트

- Express + WebSocket: `3800`
- Vite dev server: `3801` (개발 시, 프록시로 API 연결)

---

## MVP에서 제외하는 것 (Phase 2 이후)

- 규칙 위반 추이 시계열 그래프
- 에이전트 효율 분석
- 규칙 품질 자동 판정 (사문화, 비효율, 과도 트리거)
- 프로젝트 간 비교
- 규칙 자동 개선 제안
- 인증/멀티유저
- 클라우드 배포
- GitHub/Slack 연동

---

## 구현 순서

1. **서버 기본 셋업**: Express + better-sqlite3 + WebSocket, DB 스키마 생성
2. **프로젝트 등록**: POST /api/projects + INDEX.yaml 파싱 + rules 테이블 저장
3. **프롬프트 템플릿**: GET /api/projects/:id/template 생성 로직
4. **이벤트 수신**: POST /api/events + sessions 자동 관리 + WebSocket 브로드캐스트
5. **프롬프트 수신**: POST /api/sessions/:id/prompt
6. **프론트엔드**: Vite + React 셋업, 실시간 모니터 화면
7. **세션 화면**: 세션 목록 + 세션 상세
8. **규칙 조회**: 프로젝트 규칙 목록/상세 + 재스캔

---

## 실행 방법

```bash
# 서버
cd server && npm install && npm run dev

# 클라이언트
cd client && npm install && npm run dev

# 프로젝트 등록 예시
curl -X POST http://localhost:3800/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"methii","rulesPath":"/Users/mintae/projects/methii/rules"}'

# 템플릿 확인
curl http://localhost:3800/api/projects/bdn_a1b2c3d4/template
```
