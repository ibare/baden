import type { Project, Rule } from '../types.js';

export function generateInstruction(project: Project, _rules: Rule[]): string {
  return `# Baden Monitoring Protocol

이 프로젝트는 Baden 모니터링 하에 운영된다. 모든 대화에서 아래 프로토콜을 따르라.

## 설정

\`/tmp/baden\` 파일이 없으면 아래 명령을 먼저 실행하라.

\`\`\`bash
echo '#!/bin/bash
curl -s -X POST http://localhost:3800/api/query -H "Content-Type: application/json" -d "{\\"projectId\\":\\"${project.id}\\",$1}"' > /tmp/baden && chmod +x /tmp/baden
\`\`\`

## 사용자 지시 수신

사용자가 새로운 지시를 내리면, **작업을 시작하기 전에** 아래 형식으로 보고하라.
\`taskId\`에 UUID를 생성하여 할당하고, \`prompt\`에 사용자 지시 원문을 포함하라.
이후 같은 작업의 모든 보고에 동일한 \`taskId\`를 사용하라.

\`\`\`bash
# 예시 — action, reason, prompt는 상황에 맞게 자유롭게 작성하라
/tmp/baden '"action":"analyze_token_refresh_bug","reason":"사용자가 로그인 페이지의 OAuth 토큰 갱신 버그를 수정하라고 요청. 토큰 만료 시 자동 갱신이 실패하는 문제로, auth/login.ts와 lib/oauth.ts 수정이 필요할 것으로 판단","taskId":"550e8400-e29b-41d4-a716-446655440000","prompt":"로그인 페이지에서 OAuth 토큰 갱신이 안 되는 버그 수정해줘"'
\`\`\`

## 계획 수립 보고

코드를 읽거나 수정하지 않더라도, **접근 방식을 결정하거나 계획을 세울 때** 보고하라.
계획 모드(plan mode)에 진입했을 때도 동일하게 보고한다.

\`\`\`bash
# 예시 — 계획 단계에서의 보고
/tmp/baden '"action":"plan_refactor_approach","reason":"컴포넌트 분리 방식 3가지를 비교 분석하여 최적 접근법 결정","taskId":"..."'
/tmp/baden '"action":"decide_state_management","reason":"Redux vs Context vs Zustand 비교 후 Zustand 선택. 번들 크기와 보일러플레이트 최소화 기준","taskId":"..."'
\`\`\`

## 행동 보고

이후 모든 행동을 실행하기 **전에** 보고하고, 응답을 확인한 뒤 실행하라.
모든 보고에 동일한 \`taskId\`를 포함하라. 검증 행동(테스트, 빌드, 린트) 후에는 \`result\`에 결과를 포함하라.

\`\`\`bash
# 예시 — 실제 action명은 수행할 행동을 자유롭게 서술하라
/tmp/baden '"action":"read_oauth_login_logic","target":"src/auth/login.ts","reason":"OAuth 토큰 갱신 로직 확인","taskId":"550e8400-e29b-41d4-a716-446655440000"'
/tmp/baden '"action":"modify_refresh_handler","target":"src/auth/login.ts","reason":"만료된 토큰 감지 시 refresh 호출하도록 수정","ruleId":"C1","severity":"high","taskId":"550e8400-e29b-41d4-a716-446655440000"'
/tmp/baden '"action":"run_auth_tests","reason":"auth 관련 테스트 실행하여 수정사항 검증","taskId":"550e8400-e29b-41d4-a716-446655440000","result":"PASS 12/12 tests passed"'
\`\`\`

## 작업 완료 보고

작업이 완료되면 \`task_complete\` 이벤트를 보고하라. \`summary\`에 작업 결과를 요약하라.

\`\`\`bash
/tmp/baden '"action":"task_complete","taskId":"550e8400-e29b-41d4-a716-446655440000","summary":"OAuth 토큰 갱신 버그 수정 완료. auth/login.ts에서 만료 감지 로직 추가, lib/oauth.ts에서 refresh 호출 구현. 전체 12개 테스트 통과."'
\`\`\`

## 필드 참조

| 필드 | 필수 | 설명 |
|------|------|------|
| \`action\` | O | 수행할 행동을 서술하는 키워드 (예: search_token_logic, create_refresh_module, task_complete) |
| \`taskId\` | O | 작업 그룹 UUID. 사용자 지시 수신 시 생성, 이후 모든 보고에 동일값 사용 |
| \`target\` | - | 대상 파일 경로 (예: src/index.ts) |
| \`reason\` | - | 이 행동의 이유를 구체적인 문장으로 |
| \`ruleId\` | - | 관련 규칙 ID (예: C1, S-react-query). 규칙 위반/참조/수정 시 포함 |
| \`severity\` | - | 심각도 (critical, high, medium, low). 위반이나 오류 보고 시 포함 |
| \`prompt\` | - | 사용자 지시 원문. 지시 수신 이벤트에서만 포함 |
| \`summary\` | - | 작업 결과 요약. task_complete 이벤트에서만 포함 |
| \`result\` | - | 행동 결과 데이터 (테스트 pass/fail 등). 검증 행동 후 포함 |

## 원칙
- **보고 없이 행동하지 마라.** 파일 읽기, 검색, 테스트 실행 등 모든 행동은 Baden에 보고한 뒤 수행한다.
- **계획 수립도 보고하라.** 접근 방식 결정, 계획 작성 등 도구를 사용하지 않는 사고 과정도 보고 대상이다.
- **응답을 확인하라.** Baden의 응답을 확인한 후 다음 단계로 넘어가라.
- **키워드가 아닌 문장으로 기술하라.** reason 필드에는 나중에 읽어도 맥락을 이해할 수 있는 구체적인 설명을 작성하라.
- **action은 자유롭게 서술하라.** 고정된 목록이 아닌, 수행할 행동을 요약하는 \`snake_case\` 키워드를 직접 만들어 사용하라.
- **taskId로 작업을 그룹핑하라.** 하나의 사용자 지시에 대한 모든 행동은 같은 taskId를 공유한다.
- **작업 완료를 보고하라.** 지시를 모두 수행하면 task_complete 이벤트로 결과를 요약 보고한다.`;
}
