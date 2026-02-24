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
사용자의 의도, 예상 작업 범위, 주요 수정 대상을 구체적인 문장으로 기술하라.

\`\`\`bash
# 예시 — action과 reason은 상황에 맞게 자유롭게 작성하라
/tmp/baden '"action":"analyze_token_refresh_bug","reason":"사용자가 로그인 페이지의 OAuth 토큰 갱신 버그를 수정하라고 요청. 토큰 만료 시 자동 갱신이 실패하는 문제로, auth/login.ts와 lib/oauth.ts 수정이 필요할 것으로 판단"'
\`\`\`

## 행동 보고

이후 모든 행동을 실행하기 **전에** 보고하고, 응답을 확인한 뒤 실행하라.

\`\`\`bash
# 예시 — 실제 action명은 수행할 행동을 자유롭게 서술하라
/tmp/baden '"action":"read_oauth_login_logic","target":"src/auth/login.ts","reason":"OAuth 토큰 갱신 로직 확인"'
/tmp/baden '"action":"modify_refresh_handler","target":"src/auth/login.ts","reason":"만료된 토큰 감지 시 refresh 호출하도록 수정","ruleId":"C1","severity":"high"'
/tmp/baden '"action":"run_auth_tests","reason":"auth 관련 테스트 실행하여 수정사항 검증"'
\`\`\`

| 필드 | 필수 | 설명 |
|------|------|------|
| \`action\` | O | 수행할 행동을 서술하는 키워드 (예: search_token_logic, create_refresh_module, run_unit_tests) |
| \`target\` | - | 대상 파일 경로 (예: src/index.ts) |
| \`reason\` | - | 이 행동의 이유를 구체적인 문장으로 |
| \`ruleId\` | - | 관련 규칙 ID (예: C1, S-react-query). 규칙 위반/참조/수정 시 포함 |
| \`severity\` | - | 심각도 (critical, high, medium, low). 위반이나 오류 보고 시 포함 |

## 원칙
- **보고 없이 행동하지 마라.** 파일 읽기, 검색, 테스트 실행 등 모든 행동은 Baden에 보고한 뒤 수행한다.
- **응답을 확인하라.** Baden의 응답을 확인한 후 다음 단계로 넘어가라.
- **키워드가 아닌 문장으로 기술하라.** reason 필드에는 나중에 읽어도 맥락을 이해할 수 있는 구체적인 설명을 작성하라.
- **action은 자유롭게 서술하라.** 고정된 목록이 아닌, 수행할 행동을 요약하는 \`snake_case\` 키워드를 직접 만들어 사용하라.`;
}
