import { Router } from 'express';
import { isDirectoryPickerSupported, pickDirectory } from '../services/directory-picker.js';
import { warn, error as logError } from '../logger.js';
import type { DirectoryPickResult } from '../types.js';

export const fsRouter = Router();

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * cors() 가 모든 출처를 허용하므로, 외부 웹사이트가 선택창을 띄우고 고른 경로를
 * 받아 가지 못하게 로컬 출처만 받는다. Origin 이 없으면(curl 등) 허용한다.
 */
function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

// POST /api/fs/pick-directory - macOS 폴더 선택창을 띄워 절대 경로를 받는다
fsRouter.post('/pick-directory', async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (!isLocalOrigin(origin)) {
      warn('FS', `pick-directory rejected for origin ${origin}`);
      res.status(403).json({ error: 'Forbidden origin' });
      return;
    }
    if (!isDirectoryPickerSupported()) {
      res.status(501).json({ error: 'Folder picker is only available on macOS' });
      return;
    }

    const { startPath } = (req.body ?? {}) as { startPath?: string };
    const result: DirectoryPickResult = await pickDirectory(
      typeof startPath === 'string' ? startPath : undefined,
    );
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('FS', `pick-directory failed: ${message}`);
    res.status(500).json({ error: message });
  }
});
