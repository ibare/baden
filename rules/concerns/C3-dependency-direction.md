---
version: 1
last_verified: 2026-04-14
---

# Dependency Direction C3

## When to Apply
각 패키지(server, client, mcp) 내에서 모듈을 import할 때. 파일 생성, 파일 이름 변경, 새 import 문 추가 시 확인.

## MUST
- Server imports: routes → services → db/connection. routes와 services는 types.ts, logger.ts에서 import 가능. ws.ts는 routes와 services에서 접근 가능
- Client imports: pages → components → hooks → lib. components는 lib에서 직접 import 가능. ui 컴포넌트(components/ui/*)는 hooks, pages, domain 컴포넌트에서 import 불가
- MCP imports: tools → client. index.ts는 tools를 import하는 진입점

## MUST NOT
- services나 db 모듈에서 routes를 import해서는 안 된다 (server)
- components, hooks, lib에서 pages를 import해서는 안 된다 (client)
- mcp에서 client나 server 소스를 직접 import해서는 안 된다 (HTTP 통신만 허용)
- 모듈 간 순환 import를 만들어서는 안 된다

## PREFER
- 클라이언트 imports에 경로 별칭 @/* 사용
- 여러 패키지에서 공유하지 않는 타입은 해당 도메인 모듈에 co-locate
