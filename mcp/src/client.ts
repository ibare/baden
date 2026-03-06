const BADEN_URL = process.env.BADEN_API_URL || 'http://localhost:3800';

export type ResponseSource = 'server' | 'server_error' | 'fallback';

export interface BadenResponse {
  ok: boolean;
  source: ResponseSource;
}

export async function postQuery(
  payload: Record<string, unknown>,
): Promise<BadenResponse> {
  try {
    const res = await fetch(`${BADEN_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await res.json();
      return { ok: true, source: 'server' };
    }
    return { ok: true, source: 'server_error' };
  } catch {
    // 서버 접속 불가 (ECONNREFUSED 등) — 에이전트 작업을 방해하지 않음
    return { ok: true, source: 'fallback' };
  }
}
