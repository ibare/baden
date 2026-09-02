// macOS launchd LaunchAgent 제어.
// plist 를 손으로 쓰지 않도록 생성과 launchctl 호출을 여기서 감싼다.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  LABEL,
  plistPath,
  runtimeNode,
  daemonScript,
  projectRoot,
  launchdLogPath,
  resolveEnv,
} from './env.js';

const domain = `gui/${process.getuid()}`;
const serviceTarget = `${domain}/${LABEL}`;

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {{ port?: string | number }} [opts]
 * @returns {string} plist XML
 */
export function buildPlist({ port } = {}) {
  const env = resolveEnv({ port });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(LABEL)}</string>

  <!-- 셸을 거치지 않고 node 를 직접 실행한다.
       중간에 bash 가 끼면 "전체 디스크 접근" 권한의 대상 프로세스가 모호해진다. -->
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(runtimeNode)}</string>
    <string>${xmlEscape(daemonScript)}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${xmlEscape(projectRoot)}</string>

  <!-- daemon.js 의 resolveEnv() 가 같은 값을 계산하지만, plist 만 봐도 실제 설정을
       알 수 있도록 명시한다. 설치 시점의 값이 그대로 고정된다. -->
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>${xmlEscape(env.PORT)}</string>
    <key>DB_PATH</key>
    <string>${xmlEscape(env.DB_PATH)}</string>
    <key>CLIENT_DIR</key>
    <string>${xmlEscape(env.CLIENT_DIR)}</string>
  </dict>

  <!-- 로그인 시 자동 기동 -->
  <key>RunAtLoad</key>
  <true/>

  <!-- 비정상 종료만 되살린다. baden stop 은 exit 0 이라 재기동 루프에 빠지지 않는다. -->
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <!-- 빌드 누락 등으로 즉시 죽을 때 재시작이 폭주하지 않도록 -->
  <key>ThrottleInterval</key>
  <integer>10</integer>

  <!-- 부트스트랩 실패 진단용. 애플리케이션 로그는 daemon.js 가 날짜별로 따로 남긴다. -->
  <key>StandardOutPath</key>
  <string>${xmlEscape(launchdLogPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(launchdLogPath)}</string>
</dict>
</plist>
`;
}

export function isInstalled() {
  return fs.existsSync(plistPath);
}

export function writePlist({ port } = {}) {
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, buildPlist({ port }));
  return plistPath;
}

export function removePlist() {
  try {
    fs.unlinkSync(plistPath);
    return true;
  } catch {
    return false;
  }
}

function launchctl(...args) {
  const result = spawnSync('launchctl', args, { encoding: 'utf-8' });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

export function bootstrap() {
  return launchctl('bootstrap', domain, plistPath);
}

export function bootout() {
  return launchctl('bootout', serviceTarget);
}

export function kickstart() {
  return launchctl('kickstart', '-k', serviceTarget);
}

/**
 * launchd 에 로드된 상태를 조회한다.
 * @returns {{ loaded: boolean, pid: number | null, state: string | null }}
 */
export function serviceStatus() {
  const result = launchctl('print', serviceTarget);
  if (!result.ok) return { loaded: false, pid: null, state: null };

  const pidMatch = result.stdout.match(/^\s*pid\s*=\s*(\d+)/m);
  const stateMatch = result.stdout.match(/^\s*state\s*=\s*(\S+)/m);

  return {
    loaded: true,
    pid: pidMatch ? Number(pidMatch[1]) : null,
    state: stateMatch ? stateMatch[1] : null,
  };
}

export function isLoaded() {
  return serviceStatus().loaded;
}

export { serviceTarget, domain };
