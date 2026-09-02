// Baden 런처 공용 모듈 — 경로, 환경변수, 로컬 데몬 상태, 포트 유틸.
// baden.js / daemon.js / launchd.js 가 모두 이 파일 하나만 바라본다.
// 기본값을 두 곳 이상에서 계산하면 CLIENT_DIR 이 어긋나는 것과 같은 버그가 생긴다.
import path from 'path';
import os from 'os';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 식별자 ──
export const LABEL = 'com.baden.server';
export const DEFAULT_PORT = '3800';

// ── 리포 경로 ──
export const projectRoot = path.resolve(__dirname, '..');
export const binDir = path.join(projectRoot, 'bin');
export const daemonScript = path.join(binDir, 'daemon.js');
export const serverEntry = path.join(projectRoot, 'server', 'dist', 'index.js');
export const clientDist = path.join(projectRoot, 'client', 'dist');
export const clientIndex = path.join(clientDist, 'index.html');
export const serverDir = path.join(projectRoot, 'server');
export const clientDir = path.join(projectRoot, 'client');

// ── 사용자 데이터 경로 ──
export const badenHome = path.join(os.homedir(), '.baden');
export const pidPath = path.join(badenHome, 'baden.pid');
export const logsDir = path.join(badenHome, 'logs');
export const launchdLogPath = path.join(logsDir, 'launchd.log');

// launchd 가 직접 실행할 node 복사본.
// nvm 의 버전별 경로를 plist 에 박으면 노드를 올릴 때 서비스가 죽고,
// 무엇보다 이 경로가 "전체 디스크 접근" 권한을 부여받는 대상이므로 고정되어야 한다.
export const runtimeDir = path.join(badenHome, 'runtime');
export const runtimeNode = path.join(runtimeDir, 'node');
export const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

export function ensureDirs() {
  fs.mkdirSync(badenHome, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
}

/**
 * 서버 프로세스에 넘길 환경변수를 계산한다.
 * 이미 설정된 환경변수를 항상 우선한다.
 * @param {{ port?: string | number }} [opts]
 * @returns {{ PORT: string, DB_PATH: string, CLIENT_DIR: string }}
 */
export function resolveEnv({ port } = {}) {
  return {
    PORT: String(port || process.env.PORT || DEFAULT_PORT),
    DB_PATH: process.env.DB_PATH || path.join(badenHome, 'baden.db'),
    CLIENT_DIR: process.env.CLIENT_DIR || clientDist,
  };
}

// ── pid 파일 기반 로컬 데몬 (`baden start`) 상태 ──

/** @returns {{ pid: number, port: string } | null} */
export function readPid() {
  try {
    return JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function writePid(pid, port) {
  fs.writeFileSync(pidPath, JSON.stringify({ pid, port }));
}

export function clearPid() {
  try {
    fs.unlinkSync(pidPath);
  } catch {
    // 이미 없으면 그만
  }
}

export function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 살아있는 pid 데몬 정보만 돌려준다. 죽어 있으면 pid 파일을 정리한다. */
export function livePidDaemon() {
  const info = readPid();
  if (!info) return null;
  if (isRunning(info.pid)) return info;
  clearPid();
  return null;
}

// ── 포트 ──

/** @returns {Promise<boolean>} */
export function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port: Number(port), host });
    const done = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    // 응답이 느린 점유 프로세스를 "비었다"고 오판하면 이중 기동으로 이어진다.
    socket.once('timeout', () => done(true));
    socket.once('error', () => done(false));
  });
}

/**
 * 포트가 비워질 때까지 기다린다. deadline 을 넘기면 false.
 * 무한 대기 금지 — 호출부가 결과를 보고 판단한다.
 */
export async function waitForPortFree(port, timeoutMs = 8000, intervalMs = 200) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortInUse(port))) return true;
    await sleep(intervalMs);
  }
  return !(await isPortInUse(port));
}

/** 헬스체크가 응답할 때까지 기다린다. deadline 을 넘기면 false. */
export async function waitForHealthy(port, timeoutMs = 15000, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return true;
    } catch {
      // 아직 안 떴다 — 재시도
    }
    await sleep(intervalMs);
  }
  return false;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
