## 프로젝트 구조 분석

### 기본 정보
- 언어: TypeScript (전 모듈)
- 주요 프레임워크/라이브러리: Express.js (서버), React 19 + Vite (클라이언트), ws (WebSocket)
- 모노레포 여부: 모노레포 (server, client, mcp 3개 패키지)
- 모듈 목록: server (Express API + SQLite), client (React SPA), mcp (MCP 서버)
- 빌드 시스템: tsc (server, mcp), Vite (client)
- 테스트 프레임워크: 없음
- 사용 중인 정적 분석 도구: ESLint (client만, flat config), TypeScript strict mode (전 모듈)

### 규모
- 소스 파일 수: 90개
- 대략적 코드 라인 수: ~11,000줄
- DB 테이블 수: 6개 (projects, rules, events, action_registry, action_prefixes, detail_keywords)
- API 엔드포인트 수: ~25개

### 핵심 도메인
- Event Processing: 에이전트 행동을 EventType으로 분류 후 SQLite 저장 + WebSocket broadcast
- Query Protocol: 자유 서술 액션 → word 분해 → EventType 매핑 (WORD_TO_TYPE)
- Timeline Visualization: 17개 컴포넌트, GAP 압축, L자 라우팅, 미니맵
- Rule Management: INDEX.yaml 파싱, 규칙 메타데이터 관리, 파일 콘텐츠 조회
- Action Registry: 발견된 액션 패턴 추적 + 접두사/키워드 기반 분류 + 캐싱
- MCP Tools: 에이전트 ↔ Baden 서버 통신 (6개 도구)

### 발견된 공통 패턴
- DB 싱글턴: connection.ts에서 단일 인스턴스 export default
- Prepared statements: 라우트 모듈 최상위에서 생성 (connection import 시 테이블 생성 보장)
- WebSocket 싱글턴: ws.ts에서 clients Map 관리, broadcast() 함수로 브로드캐스트
- 캐시 무효화: action-registry.ts의 invalidateCache/invalidatePrefixCache/invalidateKeywordCache
- 에이전트 차단 방지: query.ts에서 모든 에러를 catch 후 { ok: true } 반환
- 의존성 단방향: routes → services → db (서버), pages → components → hooks → lib (클라이언트)

### 발견된 안티패턴
- connection.ts가 592줄 (스키마 + 10개 마이그레이션 로직 인라인)
- EventType→Category 매핑이 3곳에 중복 (server/types.ts, server/analysis.ts, client/event-types.ts)
- WORD_TO_TYPE 사전이 2곳에 중복 (query.ts, connection.ts 마이그레이션)
- events.ts POST 핸들러가 에러 시 500 반환 (에이전트 차단 가능 — C1 위반)
- 큰 컴포넌트: EventDetail.tsx (486줄), ActionRegistryPanel.tsx (444줄)
- 클라이언트에 ErrorBoundary 없음

### 정적 분석 현황
- ESLint: client만 적용 (@eslint/js + typescript-eslint + react-hooks + react-refresh)
- TypeScript: strict mode (전 모듈), 기계적 타입 검사 커버
- Prettier: 미사용
- Pre-commit hooks: 미사용
- 커버 범위: import 정합성, 타입 안전성, unused vars 등은 TS/ESLint가 처리. Rules는 설계 패턴, 의존성 방향, 도메인 제약에 집중.
