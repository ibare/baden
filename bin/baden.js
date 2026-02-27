#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 공통 경로 ──
const badenHome = path.join(os.homedir(), '.baden');
const pidPath = path.join(badenHome, 'baden.pid');
const logsDir = path.join(badenHome, 'logs');

// ── 인자 파싱 ──
const { values, positionals } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: '3800' },
  },
  allowPositionals: true,
});

const command = positionals[0] || 'start';

// ── 유틸 ──
function readPid() {
  try {
    return JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
  } catch {
    return null;
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function ensureDirs() {
  fs.mkdirSync(badenHome, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
}

function setEnv() {
  process.env.PORT = values.port;
  process.env.DB_PATH = process.env.DB_PATH || path.join(badenHome, 'baden.db');
  process.env.CLIENT_DIR = process.env.CLIENT_DIR || path.resolve(__dirname, '../client/dist');
}

// ── 서브커맨드 ──

async function cmdStart() {
  ensureDirs();

  const info = readPid();
  if (info && isRunning(info.pid)) {
    console.log(`[Baden] Already running (pid: ${info.pid}, port: ${info.port})`);
    process.exit(0);
  }

  const port = values.port;
  const child = spawn('node', [path.join(__dirname, 'daemon.js')], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: port,
      DB_PATH: process.env.DB_PATH || path.join(badenHome, 'baden.db'),
      CLIENT_DIR: process.env.CLIENT_DIR || path.resolve(__dirname, '../client/dist'),
    },
  });

  fs.writeFileSync(pidPath, JSON.stringify({ pid: child.pid, port }));
  child.unref();

  console.log(`[Baden] Daemon started (pid: ${child.pid}, port: ${port})`);
  console.log(`[Baden] Dashboard: http://localhost:${port}`);
  console.log(`[Baden] Logs: ~/.baden/logs/`);
}

function cmdStop() {
  const info = readPid();
  if (!info) {
    console.log('[Baden] Not running (no pid file)');
    return;
  }

  if (!isRunning(info.pid)) {
    console.log('[Baden] Process not found, cleaning up pid file');
    fs.unlinkSync(pidPath);
    return;
  }

  process.kill(info.pid, 'SIGTERM');
  fs.unlinkSync(pidPath);
  console.log(`[Baden] Stopped (pid: ${info.pid})`);
}

function cmdStatus() {
  const info = readPid();
  if (!info) {
    console.log('[Baden] Not running');
    return;
  }

  if (isRunning(info.pid)) {
    console.log(`[Baden] Running (pid: ${info.pid}, port: ${info.port})`);
  } else {
    console.log('[Baden] Not running (stale pid file, cleaning up)');
    fs.unlinkSync(pidPath);
  }
}

function cmdLogs() {
  ensureDirs();

  // 가장 최근 로그 파일 찾기
  const files = fs.readdirSync(logsDir)
    .filter(f => f.endsWith('.log'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('[Baden] No log files found');
    return;
  }

  const latestLog = path.join(logsDir, files[0]);
  console.log(`[Baden] Tailing ${latestLog}`);

  const tail = spawn('tail', ['-f', latestLog], { stdio: 'inherit' });
  tail.on('error', (err) => {
    console.error(`[Baden] Failed to tail logs: ${err.message}`);
  });
}

async function cmdRun() {
  ensureDirs();
  setEnv();
  await import('../server/dist/index.js');
}

// ── 실행 ──
switch (command) {
  case 'start':
    await cmdStart();
    break;
  case 'stop':
    cmdStop();
    break;
  case 'status':
    cmdStatus();
    break;
  case 'logs':
    cmdLogs();
    break;
  case 'run':
    await cmdRun();
    break;
  default:
    console.error(`[Baden] Unknown command: ${command}`);
    console.error('Usage: baden [start|stop|status|logs|run] [-p port]');
    process.exit(1);
}
