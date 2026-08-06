import { useState } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { api, type RuleSyncResult } from '@/lib/api';
import { cn } from '@/lib/utils';

interface RuleSyncControlProps {
  projectId: string;
  /** 규칙 parsed_at의 최댓값. 아직 읽은 적이 없으면 null */
  lastSyncedAt: string | null;
  /** 실제로 바뀐 게 있을 때만 호출된다 */
  onSynced: () => void;
}

/** diff를 "추가 2 · 변경 1" 형태로 압축. 바뀐 게 없으면 null */
function summarize(sync: RuleSyncResult): string | null {
  const parts: string[] = [];
  if (sync.added.length) parts.push(`추가 ${sync.added.length}`);
  if (sync.updated.length) parts.push(`변경 ${sync.updated.length}`);
  if (sync.renamed.length) parts.push(`이름변경 ${sync.renamed.length}`);
  if (sync.removed.length) parts.push(`삭제 ${sync.removed.length}`);
  if (sync.restored.length) parts.push(`복원 ${sync.restored.length}`);
  return parts.length ? parts.join(' · ') : null;
}

function formatTime(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function RuleSyncControl({ projectId, lastSyncedAt, onSynced }: RuleSyncControlProps) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const handleClick = async () => {
    setSyncing(true);
    setFailed(false);
    setMessage(null);
    try {
      const { sync } = await api.syncRules(projectId);
      const summary = summarize(sync);
      setMessage(summary ?? '변경 없음');
      // 바뀐 게 없으면 분석 데이터를 다시 부를 이유가 없다
      if (summary) onSynced();
    } catch (err) {
      console.error('Failed to sync rules:', err);
      setFailed(true);
      setMessage('재싱크 실패');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      {message && (
        <span className={cn(failed ? 'text-destructive' : 'text-muted-foreground')}>
          {message}
        </span>
      )}
      {!message && lastSyncedAt && (
        <span className="text-muted-foreground">최근 {formatTime(lastSyncedAt)}</span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={syncing}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50"
      >
        <ArrowsClockwise size={14} className={syncing ? 'animate-spin' : undefined} />
        규칙 다시 읽기
      </button>
    </div>
  );
}
