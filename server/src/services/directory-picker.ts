import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { log, warn } from '../logger.js';
import type { DirectoryPickResult } from '../types.js';

/**
 * macOS 기본 폴더 선택창으로 절대 경로를 얻는다.
 * 브라우저는 보안상 선택한 폴더의 절대 경로를 주지 않으므로 서버가 대신 띄운다.
 */

const OSASCRIPT = '/usr/bin/osascript';
const INDEX_FILE = 'INDEX.yaml';
/** 선택창을 열어 둔 채 자리를 비워도 osascript 가 남지 않도록 닫는다 */
const PICK_TIMEOUT_MS = 5 * 60_000;
const PROMPT = `Select the rules directory (the one containing ${INDEX_FILE})`;

// 시작 경로는 argv 로 받는다. 스크립트 문자열에 끼워 넣으면 AppleScript 주입이 가능해진다
const SCRIPT_LINES = [
  'on run argv',
  'activate',
  'if (count of argv) > 0 then',
  `return POSIX path of (choose folder with prompt "${PROMPT}" default location (POSIX file (item 1 of argv)))`,
  'end if',
  `return POSIX path of (choose folder with prompt "${PROMPT}")`,
  'end run',
];

/** 진행 중인 선택. 선택창은 하나만 띄우고, 겹친 요청은 같은 결과를 기다린다 */
let pending: Promise<DirectoryPickResult> | null = null;

export function isDirectoryPickerSupported(): boolean {
  return process.platform === 'darwin';
}

export function pickDirectory(startPath?: string): Promise<DirectoryPickResult> {
  if (!pending) {
    pending = runChooseFolder(startPath).finally(() => {
      pending = null;
    });
  }
  return pending;
}

function runChooseFolder(startPath?: string): Promise<DirectoryPickResult> {
  const args = SCRIPT_LINES.flatMap((line) => ['-e', line]);
  if (startPath && path.isAbsolute(startPath) && isDirectory(startPath)) {
    args.push(startPath);
  }

  return new Promise((resolve, reject) => {
    execFile(OSASCRIPT, args, { timeout: PICK_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (!err) {
        resolve(toSelected(stdout.trim()));
        return;
      }
      // 사용자가 Cancel 을 누르면 osascript 는 -128 오류로 끝난다
      if (stderr.includes('(-128)')) {
        resolve({ status: 'cancelled' });
        return;
      }
      if (err.killed) {
        warn('DirectoryPicker', `No selection within ${PICK_TIMEOUT_MS / 1000}s, closed the dialog`);
        resolve({ status: 'cancelled' });
        return;
      }
      reject(new Error(stderr.trim() || err.message));
    });
  });
}

function toSelected(posixPath: string): DirectoryPickResult {
  // 폴더의 POSIX path 는 '/' 로 끝난다
  const dir = posixPath.length > 1 ? posixPath.replace(/\/+$/, '') : posixPath;
  if (hasIndex(dir)) {
    return { status: 'selected', path: dir, hasIndex: true };
  }
  // 프로젝트 루트를 고른 경우가 흔하므로 rules/ 로 보정한다
  const nested = path.join(dir, 'rules');
  if (hasIndex(nested)) {
    log('DirectoryPicker', `${INDEX_FILE} found under rules/, using ${nested}`);
    return { status: 'selected', path: nested, hasIndex: true };
  }
  return { status: 'selected', path: dir, hasIndex: false };
}

function hasIndex(dir: string): boolean {
  return fs.existsSync(path.join(dir, INDEX_FILE));
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
