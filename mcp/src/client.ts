const BADEN_URL = process.env.BADEN_API_URL || 'http://localhost:3800';

export async function postQuery(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BADEN_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await res.json();
  } catch {
    // 서버 연결 실패, HTTP 에러 등 — 무시
  }
  return { ok: true };
}
