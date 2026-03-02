function ts(): string {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
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
