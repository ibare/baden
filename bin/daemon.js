#!/usr/bin/env node
import path from 'path';
import os from 'os';
import fs from 'fs';

const logsDir = path.join(os.homedir(), '.baden', 'logs');
fs.mkdirSync(logsDir, { recursive: true });

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
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

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
process.on('SIGTERM', () => {
  console.log('[Baden] Daemon shutting down');
  if (logStream) logStream.end();
  process.exit(0);
});

// ── 서버 시작 ──
console.log('[Baden] Daemon starting');
await import('../server/dist/index.js');
