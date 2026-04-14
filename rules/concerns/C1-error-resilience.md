---
version: 1
last_verified: 2026-04-14
---

# Error Resilience C1

## When to Apply
에이전트 데이터를 수신하는 모든 코드: 라우트 핸들러, 서비스, MCP 핸들러, WebSocket 메시지 처리.

## MUST
- 수집 엔드포인트(POST /api/query, POST /api/events)는 내부 에러 발생 시에도 HTTP 200과 성공 형태의 바디({ ok: true } 등)를 반환해야 한다
- MCP postQuery()는 fetch를 try/catch로 감싸고, 네트워크 실패 시 { ok: true, source: 'fallback' }을 반환해야 한다
- WebSocket broadcast()는 닫힌 연결을 조용히 건너뛴다. throw 금지
- 에러 상세는 logger 모듈(server/src/logger.ts의 log/warn/error)로 기록해야 한다. 조용히 삼키지 않는다

## MUST NOT
- 라우트 핸들러에서 처리되지 않은 예외를 throw해서는 안 된다. 모든 라우트 핸들러는 try/catch를 가져야 한다
- 수집 엔드포인트에서 서버 내부 에러에 HTTP 4xx/5xx를 반환해서는 안 된다 (projectName 누락 같은 입력 검증은 200 + skip으로 처리)
- 하나의 잘못된 이벤트가 서버 프로세스를 크래시시켜서는 안 된다

## PREFER
- error('ModuleName', message) 형태의 구조화된 태그로 에러 기록
- 중첩 에러 처리보다 { ok: true } 조기 반환 선호
