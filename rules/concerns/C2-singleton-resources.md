---
version: 1
last_verified: 2026-04-14
---

# Singleton & Resource Management C2

## When to Apply
공유 자원을 생성하거나 소비할 때: DB 연결, prepared statements, WebSocket 풀, 인메모리 캐시.

## MUST
- DB 연결은 server/src/db/connection.ts에서 import하여 얻어야 한다. default export가 유일한 Database 인스턴스다
- Prepared statements는 모듈 최상위 스코프에서 생성해야 한다 (connection.ts import 시 스키마 존재 보장)
- 인메모리 캐시는 명시적 무효화 함수(예: invalidateCache(projectId))를 제공해야 하며, 뮤테이션 후 호출해야 한다
- WebSocket 클라이언트 관리는 server/src/ws.ts의 addClient/removeClient/broadcast를 사용해야 한다

## MUST NOT
- connection.ts 외부에서 new Database()를 인스턴스화해서는 안 된다
- 요청 핸들러 내부에서 prepared statements를 생성해서는 안 된다 (모듈 레벨이어야 한다)
- 뮤테이션 후 캐시 무효화 없이 캐시를 읽어서는 안 된다
- ws.ts 외부에서 WebSocket 연결을 관리해서는 안 된다

## PREFER
- 캐시 무효화는 DB write 직후 같은 함수 내에서 수행
- 모든 prepared statements는 모듈 레벨 const로 선언
