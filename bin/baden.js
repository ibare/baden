#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import * as env from './env.js';
import * as launchd from './launchd.js';

// ── 인자 파싱 ──
const { values, positionals } = parseArgs({
  options: {
    port: { type: 'string', short: 'p' },
    force: { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

const command = positionals[0] || 'status';

// 등록된 서비스의 포트는 plist 에 박혀 있다. -p 는 install 로만 바꿀 수 있다.
if (values.port && ['start', 'stop', 'restart', 'status'].includes(command) && launchd.isInstalled()) {
  console.warn(`[Baden] 등록된 서비스의 포트는 plist 에 고정되어 있습니다. 바꾸려면 \`baden install -p ${values.port}\` 를 실행하세요.`);
}

// ── 공용 헬퍼 ──

function serviceLine() {
  const st = launchd.serviceStatus();
  if (!st.loaded) return null;
  return st.pid ? `pid ${st.pid}` : `state ${st.state || 'unknown'}`;
}

/** 실행 중인 pid 데몬을 내리고 포트가 풀릴 때까지 기다린다. */
async function stopPidDaemon(port) {
  const info = env.livePidDaemon();
  if (!info) {
    env.clearPid();
    return false;
  }

  process.kill(info.pid, 'SIGTERM');
  env.clearPid();
  console.log(`[Baden] 기존 데몬을 정리했습니다 (pid: ${info.pid})`);
  await env.waitForPortFree(port || info.port, 8000);
  return true;
}

/**
 * launchd 가 실행할 node 복사본을 최신 버전으로 맞춘다.
 * @returns {boolean} 복사가 일어났으면 true
 */
function syncRuntimeNode() {
  if (fs.existsSync(env.runtimeNode)) {
    const probe = spawnSync(env.runtimeNode, ['--version'], { encoding: 'utf-8' });
    if (probe.status === 0 && probe.stdout.trim() === process.version) return false;
  }

  fs.copyFileSync(process.execPath, env.runtimeNode);
  fs.chmodSync(env.runtimeNode, 0o755);
  return true;
}

/** launchd 로그에 권한 거부 흔적이 있는지 본다. */
function looksLikePermissionIssue() {
  try {
    return /Operation not permitted|EPERM/i.test(fs.readFileSync(env.launchdLogPath, 'utf-8'));
  } catch {
    return false;
  }
}

function printFullDiskAccessGuide() {
  console.log('');
  console.log('[Baden] "전체 디스크 접근" 권한이 필요합니다.');
  console.log('');
  console.log('  launchd 로 실행된 프로세스는 ~/Documents 아래를 읽지 못합니다.');
  console.log('  프로젝트의 rules/ 를 파싱하려면 아래 node 에 권한을 주어야 합니다.');
  console.log('');
  console.log(`    ${env.runtimeNode}`);
  console.log('');
  console.log('  1. 시스템 설정 → 개인정보 보호 및 보안 → 전체 디스크 접근');
  console.log('  2. + 버튼 → Cmd+Shift+G → 위 경로 입력 → node 선택');
  console.log('  3. baden restart');
  console.log('');
  console.log('  설정 창과 폴더를 바로 열려면:');
  console.log('    open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"');
  console.log(`    open ${env.runtimeDir}`);
  console.log('');
}

/** node_modules 와 숨김 파일을 뺀 최신 수정 시각(ms). 못 읽으면 0. */
function latestMtime(dir) {
  let latest = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else latest = Math.max(latest, fs.statSync(full).mtimeMs);
    }
  };

  try {
    walk(dir);
  } catch {
    return 0;
  }
  return latest;
}

/**
 * 서비스는 dist 를, `baden dev` 는 src 를 실행한다.
 * 그래서 빌드를 잊으면 개발 중에는 멀쩡한데 서비스만 옛 코드로 도는 일이 생긴다.
 */
function warnIfStaleBuild() {
  for (const [name, dir] of [['server', env.serverDir], ['client', env.clientDir]]) {
    const src = latestMtime(path.join(dir, 'src'));
    const dist = latestMtime(path.join(dir, 'dist'));
    if (src && dist && src > dist) {
      console.warn(`[Baden] ${name}/dist 가 ${name}/src 보다 오래되었습니다.`);
      console.warn('[Baden] `npm run build` 후 `baden restart` 로 반영하세요.');
    }
  }
}

function requireBuild() {
  const missing = [];
  if (!fs.existsSync(env.serverEntry)) missing.push('server/dist');
  if (!fs.existsSync(env.clientIndex)) missing.push('client/dist');

  if (missing.length > 0) {
    console.error(`[Baden] 빌드 산출물이 없습니다: ${missing.join(', ')}`);
    console.error('[Baden] 먼저 `npm run build` 를 실행하세요.');
    process.exit(1);
  }
}

// ── 서브커맨드 ──

async function cmdStart() {
  env.ensureDirs();
  warnIfStaleBuild();

  if (launchd.isInstalled()) {
    if (launchd.isLoaded()) {
      console.log(`[Baden] 서비스가 이미 실행 중입니다 (${serviceLine()})`);
      return;
    }
    const { PORT } = env.resolveEnv({ port: values.port });

    // 다른 프로세스가 포트를 잡고 있으면 bootstrap 자체는 성공하지만 데몬이 바인딩에
    // 실패해 죽고, KeepAlive 가 ThrottleInterval 마다 이를 무한 반복한다.
    if (await env.isPortInUse(PORT)) {
      console.error(`[Baden] 포트 ${PORT} 가 이미 사용 중입니다. 기동하면 재시작 루프에 빠집니다.`);
      console.error(`[Baden] 점유 프로세스: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`);
      process.exit(1);
    }

    const result = launchd.bootstrap();
    if (!result.ok) {
      console.error(`[Baden] 서비스 기동 실패: ${result.stderr.trim() || result.status}`);
      process.exit(1);
    }
    const healthy = await env.waitForHealthy(PORT);
    console.log(
      healthy
        ? `[Baden] 서비스 시작됨 — http://localhost:${PORT}`
        : `[Baden] 서비스를 기동했지만 응답이 없습니다. \`baden logs\` 로 확인하세요.`
    );
    return;
  }

  const info = env.livePidDaemon();
  if (info) {
    console.log(`[Baden] Already running (pid: ${info.pid}, port: ${info.port})`);
    return;
  }

  const resolved = env.resolveEnv({ port: values.port });
  const child = spawn('node', [env.daemonScript], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...resolved },
  });

  env.writePid(child.pid, resolved.PORT);
  child.unref();

  console.log(`[Baden] Daemon started (pid: ${child.pid}, port: ${resolved.PORT})`);
  console.log(`[Baden] Dashboard: http://localhost:${resolved.PORT}`);
  console.log(`[Baden] Logs: ~/.baden/logs/`);
}

async function cmdStop() {
  if (launchd.isInstalled() && launchd.isLoaded()) {
    const result = launchd.bootout();
    if (!result.ok) {
      console.error(`[Baden] 서비스 정지 실패: ${result.stderr.trim() || result.status}`);
      process.exit(1);
    }
    console.log('[Baden] 서비스를 정지했습니다 (다음 로그인 때 다시 기동됩니다)');
    console.log('[Baden] 완전히 해제하려면 `baden uninstall` 을 사용하세요.');
    return;
  }

  const info = env.readPid();
  if (!info) {
    console.log('[Baden] Not running (no pid file)');
    return;
  }

  if (!env.isRunning(info.pid)) {
    console.log('[Baden] Process not found, cleaning up pid file');
    env.clearPid();
    return;
  }

  process.kill(info.pid, 'SIGTERM');
  env.clearPid();
  console.log(`[Baden] Stopped (pid: ${info.pid})`);
}

async function cmdStatus() {
  const { PORT } = env.resolveEnv({ port: values.port });
  warnIfStaleBuild();

  if (launchd.isInstalled()) {
    console.log(`[Baden] LaunchAgent 등록됨 — ${env.plistPath}`);

    if (!fs.existsSync(env.runtimeNode)) {
      console.error(`[Baden] 런타임 node 가 없습니다: ${env.runtimeNode}`);
      console.error('[Baden] `baden install` 을 다시 실행하세요.');
    }

    // plist 에 박힌 진입점이 현재 리포와 다르면 리포를 옮긴 것이다.
    try {
      if (!fs.readFileSync(env.plistPath, 'utf-8').includes(env.daemonScript)) {
        console.error('[Baden] plist 의 진입점이 현재 리포지토리와 다릅니다.');
        console.error('[Baden] `baden install` 을 다시 실행하세요.');
      }
    } catch {
      // plist 를 못 읽으면 아래 launchctl 상태로 판단한다
    }

    const st = launchd.serviceStatus();
    console.log(
      st.loaded
        ? `[Baden] 서비스 실행 중 (${serviceLine()})`
        : '[Baden] 서비스 미기동 — `baden start` 로 기동하세요.'
    );
  }

  const info = env.livePidDaemon();
  if (info) {
    console.log(`[Baden] 로컬 데몬 실행 중 (pid: ${info.pid}, port: ${info.port})`);
  } else if (!launchd.isInstalled()) {
    console.log('[Baden] Not running');
  }

  const healthy = await env.waitForHealthy(PORT, 1500, 300);
  console.log(
    healthy
      ? `[Baden] 헬스체크 OK — http://localhost:${PORT}`
      : `[Baden] 포트 ${PORT} 응답 없음`
  );
}

async function cmdRestart() {
  warnIfStaleBuild();

  if (launchd.isInstalled() && launchd.isLoaded()) {
    const result = launchd.kickstart();
    if (!result.ok) {
      console.error(`[Baden] 재시작 실패: ${result.stderr.trim() || result.status}`);
      process.exit(1);
    }
    const { PORT } = env.resolveEnv({ port: values.port });
    const healthy = await env.waitForHealthy(PORT);
    console.log(healthy ? '[Baden] 서비스를 재시작했습니다' : '[Baden] 재시작했지만 응답이 없습니다');
    return;
  }

  await cmdStop();
  await env.waitForPortFree(env.resolveEnv({ port: values.port }).PORT, 8000);
  await cmdStart();
}

async function cmdInstall() {
  env.ensureDirs();
  requireBuild();
  warnIfStaleBuild();

  const resolved = env.resolveEnv({ port: values.port });

  // 기존 pid 데몬이 포트를 잡고 있으면 launchd 가 바인딩에 실패하며 재시작을 반복한다.
  await stopPidDaemon(resolved.PORT);

  if (launchd.isInstalled() && launchd.isLoaded()) {
    launchd.bootout();
    await env.waitForPortFree(resolved.PORT, 8000);
  }

  // 개발 서버 등 우리가 모르는 프로세스가 포트를 잡고 있으면 launchd 가
  // 바인딩에 실패한 채 ThrottleInterval 마다 재시작을 반복한다.
  if (await env.isPortInUse(resolved.PORT)) {
    console.error(`[Baden] 포트 ${resolved.PORT} 가 이미 사용 중입니다.`);
    console.error(`[Baden] 점유 프로세스: lsof -nP -iTCP:${resolved.PORT} -sTCP:LISTEN`);
    console.error('[Baden] 해당 프로세스를 종료한 뒤 다시 실행하세요.');
    process.exit(1);
  }

  // launchd 가 실행할 node 를 고정 경로에 둔다. 이 경로가 권한 부여 대상이다.
  const copied = syncRuntimeNode();
  console.log(
    copied
      ? `[Baden] node ${process.version} 복사 → ${env.runtimeNode}`
      : `[Baden] node ${process.version} 최신 상태 (${env.runtimeNode})`
  );

  // 이전 부트스트랩 실패 기록이 무한히 쌓이지 않도록 비운다.
  fs.writeFileSync(env.launchdLogPath, '');

  const plist = launchd.writePlist({ port: resolved.PORT });
  const result = launchd.bootstrap();
  if (!result.ok) {
    console.error(`[Baden] 등록 실패: ${result.stderr.trim() || result.status}`);
    console.error(`[Baden] 진단 로그: ${env.launchdLogPath}`);
    process.exit(1);
  }

  const healthy = await env.waitForHealthy(resolved.PORT);

  console.log('[Baden] LaunchAgent 등록 완료');
  console.log(`  plist   : ${plist}`);
  console.log(`  런타임   : ${env.runtimeNode}`);
  console.log(`  진입점   : ${env.daemonScript}`);
  console.log(`  DB      : ${resolved.DB_PATH}`);
  console.log(`  대시보드 : http://localhost:${resolved.PORT}`);
  console.log('');

  if (healthy) {
    console.log('[Baden] 서버가 응답합니다. 이제 로그인할 때마다 자동으로 실행됩니다.');
    console.log('[Baden] 프로젝트 디렉터리를 옮기면 `baden install` 을 다시 실행해야 합니다.');
    return;
  }

  if (looksLikePermissionIssue()) {
    printFullDiskAccessGuide();
    return;
  }

  console.log(`[Baden] 아직 응답이 없습니다. ${env.launchdLogPath} 를 확인하세요.`);
}

async function cmdUninstall() {
  if (!launchd.isInstalled()) {
    console.log('[Baden] 등록된 LaunchAgent 가 없습니다');
    return;
  }

  if (launchd.isLoaded()) {
    const result = launchd.bootout();
    if (!result.ok) {
      console.error(`[Baden] 언로드 실패: ${result.stderr.trim() || result.status}`);
      process.exit(1);
    }
  }

  launchd.removePlist();
  env.clearPid();
  console.log('[Baden] LaunchAgent 를 제거했습니다');
}

async function cmdRun() {
  // 서비스든 데몬이든 이미 떠 있으면 같은 포트와 같은 DB 파일을 두 프로세스가 잡는다.
  const serviceUp = launchd.isInstalled() && launchd.isLoaded();
  const daemonUp = env.livePidDaemon();

  if ((serviceUp || daemonUp) && !values.force) {
    const who = serviceUp ? '서비스' : `데몬 (pid: ${daemonUp.pid})`;
    console.error(`[Baden] ${who}가 이미 실행 중입니다. 포그라운드로 또 띄우면 포트와 DB 가 충돌합니다.`);
    console.error('[Baden] `baden stop` 후 다시 시도하거나 `baden run --force` 를 사용하세요.');
    process.exit(1);
  }

  env.ensureDirs();
  Object.assign(process.env, env.resolveEnv({ port: values.port }));
  await import(pathToFileURL(env.serverEntry).href);
}

function cmdLogs() {
  env.ensureDirs();

  const files = fs
    .readdirSync(env.logsDir)
    .filter((f) => f.endsWith('.log') && f !== 'launchd.log')
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('[Baden] No log files found');
    return;
  }

  const latestLog = path.join(env.logsDir, files[0]);
  console.log(`[Baden] Tailing ${latestLog}`);

  const tail = spawn('tail', ['-f', latestLog], { stdio: 'inherit' });
  tail.on('error', (err) => {
    console.error(`[Baden] Failed to tail logs: ${err.message}`);
  });
}

// ── 개발 모드 ──
// 상시 서비스가 3800 을 잡고 있으므로 잠시 비켜뒀다가 종료 시 되돌린다.
async function cmdDev() {
  const resolved = env.resolveEnv({ port: values.port });

  const serverBin = path.join(env.serverDir, 'node_modules', '.bin', 'tsx');
  const clientBin = path.join(env.clientDir, 'node_modules', '.bin', 'vite');

  for (const [bin, where] of [[serverBin, 'server'], [clientBin, 'client']]) {
    if (!fs.existsSync(bin)) {
      console.error(`[Baden] ${where} 의존성이 설치되지 않았습니다: ${bin}`);
      console.error(`[Baden] \`cd ${where} && npm ci\` 를 먼저 실행하세요.`);
      process.exit(1);
    }
  }

  // 1. 자리 비우기
  let restoreService = false;
  if (launchd.isInstalled() && launchd.isLoaded()) {
    launchd.bootout();
    restoreService = true;
    console.log('[Baden] 개발 모드 — 서비스를 잠시 정지했습니다');
  }
  await stopPidDaemon(resolved.PORT);

  if (!(await env.waitForPortFree(resolved.PORT))) {
    console.error(`[Baden] 포트 ${resolved.PORT} 가 아직 사용 중입니다. 점유 중인 프로세스를 확인하세요.`);
    if (restoreService) launchd.bootstrap();
    process.exit(1);
  }

  // 2. 자식 실행
  // npm 을 거치면 npm -> tsx/vite 로 손자가 생겨 SIGTERM 이 닿지 않는다.
  // 바이너리를 직접 실행하고, detached 로 프로세스 그룹을 만들어 그룹째 정리한다.
  const alive = new Set();
  // 프로세스 그룹 id 는 자식이 죽어도 지우지 않는다.
  // 직계 자식만 먼저 죽고 손자(esbuild service, tsx worker)가 남는 경우가 있어,
  // 그룹 자체에 시그널을 보내야 고아가 남지 않는다.
  const groups = new Set();

  const run = (name, bin, args, cwd) => {
    const child = spawn(bin, args, {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...resolved },
    });

    const relay = (stream, target) => {
      let buffer = '';
      stream.setEncoding('utf-8');
      stream.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) target.write(`[${name}] ${line}\n`);
      });
    };

    relay(child.stdout, process.stdout);
    relay(child.stderr, process.stderr);

    child.on('exit', (code) => {
      alive.delete(child);
      console.log(`[${name}] 종료 (code: ${code})`);
      // 자식이 스스로 다 죽으면 이벤트 루프가 비면서 부모가 그냥 끝난다.
      // 그대로 두면 비켜준 서비스가 복귀하지 못한 채 남는다.
      if (alive.size === 0) void cleanup(code ?? 0);
    });

    alive.add(child);
    groups.add(child.pid);
    return child;
  };

  // 3. 종료 처리 — 프로세스 그룹째 정리한 뒤 서비스 복귀
  let cleaning = false;
  const cleanup = async (code) => {
    if (cleaning) return;
    cleaning = true;

    const signal = (sig) => {
      for (const pgid of groups) {
        try {
          process.kill(-pgid, sig);
        } catch {
          // 그룹이 이미 사라졌으면 그만
        }
      }
    };

    signal('SIGTERM');
    await env.sleep(1500);
    signal('SIGKILL');

    if (restoreService) {
      await env.waitForPortFree(resolved.PORT, 5000);
      const result = launchd.bootstrap();
      console.log(result.ok ? '[Baden] 서비스를 복귀시켰습니다' : `[Baden] 서비스 복귀 실패: ${result.stderr.trim()}`);
    }

    process.exit(code);
  };

  process.on('SIGINT', () => void cleanup(130));
  process.on('SIGTERM', () => void cleanup(143));
  // 자식이 별도 프로세스 그룹에 있어 터미널을 닫아도 SIGHUP 이 전달되지 않는다.
  process.on('SIGHUP', () => void cleanup(129));
  process.on('uncaughtException', (err) => {
    console.error(err);
    void cleanup(1);
  });

  run('server', serverBin, ['watch', 'src/index.ts'], env.serverDir);
  run('client', clientBin, [], env.clientDir);

  console.log(`[Baden] server → http://localhost:${resolved.PORT}`);
  console.log('[Baden] client → http://localhost:3801');
  console.log('[Baden] Ctrl+C 로 종료하면 서비스가 자동으로 복귀합니다');
}

// ── 실행 ──
const commands = {
  start: cmdStart,
  stop: cmdStop,
  restart: cmdRestart,
  status: cmdStatus,
  install: cmdInstall,
  uninstall: cmdUninstall,
  dev: cmdDev,
  run: cmdRun,
  logs: cmdLogs,
};

const handler = commands[command];
if (!handler) {
  console.error(`[Baden] Unknown command: ${command}`);
  console.error('Usage: baden <command> [-p port]');
  console.error('');
  console.error('  install     로그인 시 자동 실행되도록 LaunchAgent 등록');
  console.error('  uninstall   LaunchAgent 제거');
  console.error('  start       서비스/데몬 시작');
  console.error('  stop        서비스/데몬 정지');
  console.error('  restart     재시작');
  console.error('  status      실행 상태 확인');
  console.error('  dev         개발 모드 (서비스 정지 → hot reload → 종료 시 복귀)');
  console.error('  run         포그라운드 실행');
  console.error('  logs        최신 로그 tail');
  process.exit(1);
}

await handler();
