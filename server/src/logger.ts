function ts(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function log(tag: string, message: string): void {
  console.log(`${ts()} [${tag}] ${message}`);
}

export function warn(tag: string, message: string): void {
  console.warn(`${ts()} [${tag}] ${message}`);
}

export function error(tag: string, message: string): void {
  console.error(`${ts()} [${tag}] ${message}`);
}
