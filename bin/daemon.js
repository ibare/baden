#!/usr/bin/env node
// 서버 프로세스 본체. `baden start` 의 detached 자식이자 launchd 의 실행 대상.
// stdout/stderr 를 날짜별 로그 파일로 돌린 뒤 서버를 로드한다.
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { logsDir, ensureDirs, resolveEnv, serverEntry } from './env.js';

ensureDirs();

// launchd 는 baden.js 를 거치지 않고 이 파일을 바로 실행한다.
// 여기서 기본값을 채워야 CLIENT_DIR 이 비어 대시보드가 서빙되지 않는 일이 없다.
Object.assign(process.env, resolveEnv());

// ── 날짜별 로그 스트림 관리 ──
let currentDate = '';
let logStream = null;

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ensureStream() {
  const today = getToday();
  if (today !== currentDate) {
    if (logStream) {
      logStream.end();
    }
    currentDate = today;
    logStream = fs.createWriteStream(path.join(logsDir, `${today}.log`), { flags: 'a' });
  }
  return logStream;
}

function timestamp() {
  return new Date().toISOString();
}

// ── stdout/stderr 리다이렉트 ──
process.stdout.write = (chunk, encoding, callback) => {
  const stream = ensureStream();
  const line = `[${timestamp()}] ${chunk}`;
  stream.write(line, encoding, callback);
  return true;
};

process.stderr.write = (chunk, encoding, callback) => {
  const stream = ensureStream();
  const line = `[${timestamp()}] [ERR] ${chunk}`;
  stream.write(line, encoding, callback);
  return true;
};

// ── 정상 종료 처리 ──
// exit 0 으로 끝나야 launchd 의 KeepAlive(SuccessfulExit:false)가 재기동하지 않는다.
process.on('SIGTERM', () => {
  console.log('[Baden] Daemon shutting down');
  if (logStream) logStream.end();
  process.exit(0);
});

// ── 서버 시작 ──
console.log('[Baden] Daemon starting');
console.log(`[Baden] port=${process.env.PORT} db=${process.env.DB_PATH}`);
console.log(`[Baden] client=${process.env.CLIENT_DIR}`);

await import(pathToFileURL(serverEntry).href);
