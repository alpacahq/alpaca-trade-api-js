import { spawnSync, type SpawnSyncOptions } from "node:child_process";

/**
 * Executables this pipeline is ever allowed to spawn. Spawning is never done
 * through a shell (no `shell: true`), but we still allowlist the command and
 * reject arguments containing control characters as defense-in-depth against
 * tainted input (CLI args, environment, fetched data) reaching a child process.
 */
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  "bash",
  "npm",
  "npx",
  "git",
  "java",
  "/usr/libexec/java_home",
]);

function assertSafeInvocation(cmd: string, args: readonly string[]): void {
  if (!ALLOWED_COMMANDS.has(cmd)) {
    throw new Error(`Refusing to spawn disallowed command: ${JSON.stringify(cmd)}`);
  }
  for (const arg of args) {
    // Argv is passed directly (no shell), but NUL/newline in an arg always
    // indicates corrupted/tainted input — never a legitimate pipeline argument.
    if (typeof arg !== "string" || /[\u0000\n\r]/.test(arg)) {
      throw new Error(`Refusing unsafe argument: ${JSON.stringify(arg)}`);
    }
  }
}

/** Run a command inheriting stdio; throw on non-zero exit. */
export function run(cmd: string, args: string[], opts: SpawnSyncOptions = {}): void {
  assertSafeInvocation(cmd, args);
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts, shell: false });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Command failed (exit ${res.status}): ${cmd} ${args.join(" ")}`);
  }
}

/** Run a command capturing stdout (trimmed); returns null on non-zero exit. */
export function capture(cmd: string, args: string[], opts: SpawnSyncOptions = {}): string | null {
  assertSafeInvocation(cmd, args);
  const res = spawnSync(cmd, args, { ...opts, encoding: "utf8", shell: false });
  if (res.status !== 0) return null;
  return String(res.stdout ?? "").trim();
}
