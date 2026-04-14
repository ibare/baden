## AUDIT-v1 결과

감사일: 2026-04-14

### 요약
- 총 위반: 1건
- Critical: 0건 / High: 1건 / Medium: 0건 / Low: 0건
- 준수율: 98%

### 위반 목록
| # | 규칙 | 파일 | Severity | 내용 | 상태 |
|---|------|------|:--------:|------|------|
| 1 | C1 | server/src/routes/events.ts:20 | High | POST 에러 시 500 반환 — 에이전트 차단 가능 | **수정 완료** |

### 예외 판정
| 규칙 | 파일 | 내용 | 사유 |
|------|------|------|------|
| C4 | types.ts, event-types.ts, analysis.ts | EVENT_CATEGORY_MAP 3곳 중복 | 서버/클라이언트 별도 패키지, 공유 패키지 미추출. 수동 동기화 필요. |
| C4 | connection.ts | WORD_TO_TYPE 마이그레이션 복사본 | 과거 마이그레이션 코드 동결. 정본은 query.ts. |

### AUDIT-v2 (수정 후 확인)
- events.ts 20행: `res.status(500).json({ error: message })` → `res.json({ ok: true })` 수정 완료
- Critical: 0건, High: 0건 달성
