---
version: 1
last_verified: 2026-04-14
---

# Principles

모든 코드에 항상 적용되는 핵심 원칙.

## 1. Never Block the Agent
- Baden은 모니터링 도구다. Baden의 에러가 모니터링 대상 에이전트의 작업을 방해해서는 안 된다
- 수집 엔드포인트(POST /api/query, POST /api/events)는 내부 에러에도 성공 응답을 반환한다
- MCP 클라이언트는 네트워크/파싱 에러를 catch하고 fallback 응답을 반환한다

## 2. Unidirectional Dependency
- 의존성은 한 방향으로만 흐른다. 역방향 import 금지
- Server: routes → services → db
- Client: pages → components → hooks → lib
- MCP: tools → client
- Cross-package: MCP → Server (HTTP), Client → Server (HTTP/WS)

## 3. Singleton Resources
- 공유 자원(DB 연결, WebSocket 풀, 캐시)은 단일 인스턴스로 관리한다
- 새로운 공유 자원도 동일 패턴을 따른다

## 4. Type Contracts at Boundaries
- 모듈 경계에 TypeScript 인터페이스로 입출력을 정의한다
- 새 엔드포인트/도구 추가 시 타입 계약을 먼저 정의한다

## 5. Minimal Change Surface
- 수정은 필요한 파일만 터치한다
- 기능 PR에 투기적 리팩토링을 포함하지 않는다

## 6. Classification Consistency
- EventType, EventCategory, 매핑 사전은 핵심 도메인 어휘다
- 새 EventType 추가 시 EventType union, EVENT_CATEGORY_MAP, TYPE_CONFIG를 모두 갱신한다
- WORD_TO_TYPE과 action_prefixes seed 데이터를 동기화한다
