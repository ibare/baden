# Baden 추가 개선 로드맵 (Phase 2~4)

## Phase 2: 분석 대시보드

### 규칙 효과 분석

```
GET /api/analysis/rule-trends?projectId=X&ruleId=C2&period=30d
```

- 규칙별 위반 빈도 추이 (세션 단위 시계열)
- 위반→수정 평균 소요 시간 (rule_match ~ fix_applied 간격)
- 반복 위반 규칙 감지 (매 세션마다 동일 규칙 위반 발생)

### 에이전트 효율 분석

```
GET /api/analysis/agent-efficiency?projectId=X
```

- 세션별 위반 발견율: violation_found / rule_match
- 수정 성공률: fix_applied / violation_found
- 평균 수정 소요 시간
- 세션 간 효율 변화 추이

### 규칙 품질 자동 판정

```
GET /api/analysis/rule-quality?projectId=X
```

| 판정 | 조건 | 제안 |
|------|------|------|
| 사문화 | 최근 N세션 매칭 있으나 위반 0 | PREFER로 완화 검토 |
| 비효율 | 위반 반복 + 수정 시간 > 평균 2배 | 규칙 문구 개선 필요 |
| 과도 트리거 | 매칭 수가 상위 5% + 위반율 < 5% | INDEX.yaml 트리거 정밀도 개선 |
| 사각지대 | 특정 디렉토리에서 규칙 매칭 0 | 트리거 누락 가능성 |

### 프로젝트 간 비교

- 동일 카테고리 규칙(concerns vs specifics) 준수율 비교
- 규칙 체계 성숙도 점수: 규칙 수 × 준수율 × 위반 감소 추세

### 프론트엔드 추가 화면

- **Analysis 페이지**: 위반 추이 차트, 규칙 품질 카드, 에이전트 효율 지표
- **Rule Detail 페이지**: 특정 규칙 드릴다운 (위반 이력, 파일 Top, 판정)
- **Compare 페이지**: 프로젝트 간 비교 대시보드

---

## Phase 3: 규칙 자동 개선 제안

### 데이터 기반 제안 생성

축적된 이벤트 데이터를 분석하여 구체적인 규칙 개선 제안을 자동 생성.

```
GET /api/suggestions?projectId=X
```

제안 유형:
- "C6 (registry-pattern): 최근 10세션 위반 0건. PREFER로 완화를 검토하라."
- "C9 (type-definition): any 패턴 위반이 매 세션 반복. Bad 예시에 최다 위반 패턴 추가를 검토하라."
- "C3 (error-handling): 트리거 매칭 376건 중 위반 12건 (3.2%). INDEX.yaml의 patterns 필터를 좁혀라."

### INDEX.yaml 수정 제안

과도 트리거 규칙에 대해 triggers 섹션 수정안을 구체적으로 제시:

```yaml
# 현재
- id: C3
  triggers:
    patterns: ["ApiResponse", "ApiError", "ErrorCodes", ...]

# 제안: 위반이 주로 발생하는 패턴만 남기기
- id: C3
  triggers:
    patterns: ["ApiError", "ErrorCodes", "ApplicationFailure"]
    # 제거 제안: "ApiResponse" (매칭 200건, 위반 0건)
```

### 위반 패턴 자동 추출

반복 위반 규칙에 대해, 실제 위반 메시지에서 패턴을 추출하여 규칙 파일의 안티패턴 섹션에 추가할 내용 제안.

---

## Phase 4: 팀/클라우드

### 인프라 전환

- SQLite → PostgreSQL (멀티유저 동시 접속)
- 로컬 서버 → 클라우드 배포 (Cloud Run 또는 Railway)
- 인증: API Key 기반 (에이전트 curl용) + OAuth (대시보드용)

### 외부 연동

- **GitHub**: PR과 세션 연결, 위반 코멘트 자동 생성
- **Slack/Discord**: Critical 위반 실시간 알림
- **CI/CD**: 빌드 파이프라인에서 Baden 세션 자동 시작/종료

### 멀티유저

- 팀 내 여러 개발자의 에이전트 작업을 하나의 대시보드에서 관찰
- 개발자별 에이전트 효율 비교 (민감 → opt-in)
- 프로젝트 접근 권한 관리
