#!/bin/bash
# 서브에이전트(rule-guard)가 MCP 도구 대신 HTTP 로 Baden 에 보고할 때 쓰는 래퍼를 만든다.
# /tmp 는 재부팅하면 비워지므로 세션이 시작될 때마다 다시 만든다.
cat > /tmp/baden-baden << 'SCRIPT'
#!/bin/bash
# 보고가 실패해도 에이전트 작업을 막지 않도록 항상 0 으로 끝낸다
curl -s -m 3 -X POST "${BADEN_API_URL:-http://localhost:3800}/api/query" \
  -H 'Content-Type: application/json' \
  -d "{\"projectName\":\"baden\",$1}" || true
exit 0
SCRIPT
chmod +x /tmp/baden-baden
