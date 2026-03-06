# baden_report 도구 구현 방안

## 배경

에이전트가 사용자에게 마크다운으로 보고하는 내용(분석 결과, 설계 제안, 표 등)이 Baden에 전달되지 않음.
현재 MCP 도구는 `action`, `reason` 등 메타데이터만 전송하고, 실제 보고 본문은 유실됨.

## 핵심 아이디어

"보고 = 도구 호출"로 만들어 누락 가능성 제거.

```
baden_report({ taskId, title, content })
→ 서버에 마크다운 저장
→ 반환: { ok: true, content: "..." }
→ Claude가 반환된 content를 사용자에게 출력
```

에이전트가 별도로 텍스트를 출력할 필요 없이, 도구 반환값이 곧 사용자에게 보이는 보고가 됨.

## 변경 범위

### 1. DB 스키마

`events` 테이블에 `content TEXT` 컬럼 추가.

```sql
ALTER TABLE events ADD COLUMN content TEXT;
```

`server/src/db/connection.ts`의 스키마 정의와 마이그레이션에 반영.

### 2. Server 타입 (`server/src/types.ts`)

```typescript
// EventInput에 추가
content?: string;

// QueryInput에 추가
content?: string;

// RuleEvent에 추가
content: string | null;
```

### 3. Event Processor (`server/src/services/event-processor.ts`)

INSERT 쿼리에 `content` 컬럼 추가.

```typescript
const insertEvent = db.prepare(`
  INSERT INTO events (id, timestamp, type, project_id, ..., content)
  VALUES (?, ?, ?, ?, ..., ?)
`);

// processEvent 내부
insertEvent.run(
  ...
  input.content || null,
);
```

### 4. Query Route (`server/src/routes/query.ts`)

query → EventInput 변환 시 `content` 필드 매핑 추가.

### 5. MCP 도구 (`mcp/src/tools.ts`)

```typescript
{
  name: 'baden_report',
  description:
    'Call when you want to present analysis, proposals, or reports to the user. '
    + 'The returned content will be displayed to the user as-is. '
    + 'Do NOT output the report text yourself — the tool return value IS the report.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID from baden_start_task' },
      title: { type: 'string', description: 'Report title (used as event message)' },
      content: { type: 'string', description: 'Full markdown report body' },
    },
    required: ['taskId', 'title', 'content'],
  },
  handler: async (args) => {
    const result = await postQuery({
      action: 'report',
      message: args.title,
      content: args.content,
      taskId: args.taskId,
      projectName: taskProjectMap.get(args.taskId as string),
    });
    // 반환값에 content를 포함하여 Claude가 사용자에게 출력하도록 함
    return { ...result, content: args.content };
  },
}
```

### 6. CLAUDE.md 지시 추가

```markdown
### 보고 작성
사용자에게 분석 결과, 설계 제안, 조사 보고 등을 전달할 때는 `baden_report`를 사용하라.
- title: 보고 제목 (한 줄)
- content: 마크다운 본문 전체
- 반환된 content가 사용자에게 그대로 표시된다. 별도로 같은 내용을 출력하지 마라.
```

### 7. Client 표시

이벤트 상세 패널에서 `content`가 있으면 마크다운으로 렌더링.

```tsx
// SessionDetail.tsx 또는 EventDetailPanel 내부
{event.content && (
  <div className="prose prose-sm">
    <ReactMarkdown>{event.content}</ReactMarkdown>
  </div>
)}
```

## 타임라인 표현

- `report` action → SIGNAL_ACTIONS에 추가하여 instant 마커로 렌더링
- 전용 SVG 아이콘(예: 문서/메모 형태) 사용 권장
- 카테고리: `planning` (분석/보고는 계획 단계에 해당)

## 검증 체크리스트

- [ ] `baden_report` 호출 시 DB에 content가 저장되는지
- [ ] 반환값에 content가 포함되어 Claude 출력에 나오는지
- [ ] 클라이언트 이벤트 상세에서 마크다운이 렌더링되는지
- [ ] 타임라인에 report 마커가 표시되는지
- [ ] content 없는 기존 이벤트에 영향 없는지
