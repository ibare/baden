---
version: 1
last_verified: 2026-04-14
---

# Data Mapping Consistency C4

## When to Apply
EventType, EventCategory, WORD_TO_TYPE, EVENT_CATEGORY_MAP, TYPE_CONFIG, action_prefixes seed 데이터를 수정할 때. 새 이벤트 타입이나 카테고리를 추가할 때.

## MUST
- 새 EventType은 다음 모든 위치에 추가해야 한다: server/src/types.ts (EventType union + EVENT_CATEGORY_MAP), client/src/lib/event-types.ts (EVENT_CATEGORY_MAP + TYPE_CONFIG), server/src/routes/analysis.ts (TYPE_TO_CATEGORY)
- 새 EventCategory는 다음 모든 위치에 추가해야 한다: server/src/types.ts, client/src/lib/event-types.ts (EventCategory union + CATEGORY_CONFIG), client/src/components/timeline/lib/constants.ts (CATEGORY_ORDER)
- 쿼리 프로토콜의 새 단어 매핑은 server/src/routes/query.ts (WORD_TO_TYPE)에 추가해야 한다
- query.ts의 WORD_TO_TYPE이 정본(canonical source)이다. connection.ts의 복사본은 과거 마이그레이션 코드이며 수정해서는 안 된다

## MUST NOT
- EventType을 한 매핑 위치에만 추가하고 나머지를 빠뜨려서는 안 된다
- connection.ts의 WORD_TO_TYPE 사전을 수정해서는 안 된다 (마이그레이션 코드는 동결)
- 새 매핑 사전을 이 규칙에 문서화하지 않고 도입해서는 안 된다

## PREFER
- 카테고리 추가 시 connection.ts의 action_prefixes seed 데이터와 TYPE_CONFIG 색상을 동시에 업데이트
- TYPE_CONFIG 아이콘은 카테고리의 의미와 일관되게 선택
