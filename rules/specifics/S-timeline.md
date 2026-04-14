---
version: 1
last_verified: 2026-04-14
---

# Timeline Visualization S-timeline

## When to Apply
client/src/components/timeline/ 하위 파일을 수정하거나, 해당 디렉토리에서 import하는 파일을 수정할 때.

## MUST
- 모든 시간→픽셀 변환은 CompressedTimeMap(msToX, xToMs, durationToWidth)을 경유해야 한다. 직접 산술(ms / 60000 * ppm)은 gap-compression.ts와 algorithms.ts 내부에서만 허용된다
- 타임라인 레이아웃은 4단계 파이프라인을 따라야 한다: (1) RuleEvent → TimelineItem (2) 시간 범위 계산 (3) CompressedTimeMap 빌드 (4) Lane + PlacedItem 계산. 단계들은 useTimelineLayout.ts에 있다
- 새 시각 요소(마커, 연결선, 오버레이)는 레이아웃 파이프라인의 PlacedItem 좌표를 받아야 한다. 독립적으로 위치를 계산해서는 안 된다
- GAP 압축 상수(GAP_THRESHOLD_MS, COMPRESSED_GAP_PX, CLUSTER_PADDING_MS 등)는 constants.ts에 정의해야 한다. 알고리즘 코드에 매직 넘버 금지
- Connection 타입은 Connection.type union('rule_chain' | 'file_link' | 'task_chain')에 정의해야 한다. 새 연결 타입은 여기에 추가

## MUST NOT
- gap 압축을 우회하여 원시 ms→px 변환으로 위치 요소를 배치해서는 안 된다
- 레이아웃 상수(SUB_ROW_HEIGHT, BAR_HEIGHT, LANE_GAP 등)를 인라인 리터럴로 삽입해서는 안 된다. constants.ts를 참조해야 한다
- lib/ 모듈에 상태 관리(useState, useEffect)를 추가해서는 안 된다. lib/는 순수 연산이다
- 역할 분리를 깨서는 안 된다: Timeline.tsx가 오케스트레이션, hooks가 연산, lib가 순수 함수. lib/에 hooks 금지, lib/에 React 상태 금지

## PREFER
- Timeline.tsx에 인라인하기보다 timeline/hooks/ 아래에 새 훅으로 연산을 추출
- Timeline.tsx는 얇은 조합 레이어로 유지 (현재 264줄, ~350줄 이하 권장)
