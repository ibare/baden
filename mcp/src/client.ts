const BADEN_URL = process.env.BADEN_API_URL || 'http://localhost:3800';
const PROJECT_ID = process.env.BADEN_PROJECT_ID;

export async function postQuery(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BADEN_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: PROJECT_ID, ...payload }),
  });
  return (await res.json()) as { ok: boolean; error?: string };
}
