---
version: 1
last_verified: 2026-04-14
---

# Query Protocol S-query-protocol

## When to Apply
server/src/routes/query.ts, mcp/src/tools.ts, mcp/src/client.ts를 수정할 때. 액션 파싱이나 분류 방식을 변경할 때.

## MUST
- 쿼리 엔드포인트(POST /api/query)는 모든 경우에 { ok: true }를 반환해야 한다 -- 성공, 프로젝트 미등록, 액션 누락, 내부 에러 모두
- 액션 분류는 word 분해 알고리즘을 사용해야 한다: _로 분할, SKIP_WORDS 건너뛰기, 첫 매칭 단어를 WORD_TO_TYPE에서 조회. 매칭 없으면 'query' 타입으로 fallback
- 액션이 DIRECT_EVENT_TYPES 집합(예: 'task_complete')에 있으면, word 분해를 바이패스하고 직접 매핑해야 한다
- 단어 매칭이 없지만 ruleId가 있으면, 타입은 'rule_match'여야 한다
- MCP 도구는 모든 postQuery 호출에 taskId를 전달해야 한다 (인메모리 taskProjectMap이 projectName 해석 제공)
- projectName은 getProjectIdByName()으로 projectId로 해석해야 한다. 미등록 프로젝트는 조용히 skip(로그 + ok 반환)

## MUST NOT
- 쿼리 엔드포인트에서 HTTP 에러 상태 코드(4xx, 5xx)를 반환해서는 안 된다
- 쿼리 입력에 projectId를 요구해서는 안 된다 -- projectName만 허용 (projectId는 서버에서 해석)
- 대응하는 postQuery 페이로드 형식 없이 새 MCP 도구를 추가해서는 안 된다
- 기존 액션 패턴의 분류 결과를 검증하지 않고 SKIP_WORDS나 WORD_TO_TYPE을 수정해서는 안 된다

## PREFER
- 새 MCP 도구는 기존 패턴을 따를 것: 이름이 baden_으로 시작, taskId를 받고, postQuery 호출
- 새 보고 패턴 설계 시 기존 WORD_TO_TYPE 항목과 맞는 액션 동사를 사용
